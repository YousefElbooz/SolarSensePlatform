"""
Export the ERA5 preprocessing results as one compact JSON file for the
/preprocessing page of the platform.

It runs the same steps as data_preprocessing.py (merge the accum/instant
files, check the time axis, convert units, convert to Africa/Cairo and keep
the daytime window, add derived features, quality report) and records what
each step did, then aggregates the cleaned data into the series the page draws.

Usage
  python export_web.py <folder with the .nc files> <output json>
  python export_web.py ../../../archive ../../public/data/preprocessing.json

Install
  pip install xarray netcdf4 numpy pandas
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import xarray as xr

DATA_DIR = Path(sys.argv[1])
OUT_PATH = Path(sys.argv[2])

LOCAL_TZ = "Africa/Cairo"
LOCAL_HOURS = (6, 19)
CORE = ["ssrd", "fdir", "ssrdc", "t2m", "u10", "v10", "sp"]
RADIATION = ["ssrd", "fdir", "ssrdc", "cdir", "strd", "tisr"]
KELVIN = ["t2m", "d2m", "skt"]
ACCUM = set(RADIATION) | {"tp"}
SPATIAL = ("latitude", "longitude")
PLOT_VARS = ["ssrd", "fdir", "diffuse", "t2m", "u10", "v10", "wind_speed", "sp"]
MAP_VARS = ["ssrd", "fdir", "t2m", "sp", "wind_speed", "u10", "v10"]
DECIMALS = {"ssrd": 1, "fdir": 1, "diffuse": 1, "ssrdc": 1, "t2m": 2, "u10": 2,
            "v10": 2, "wind_speed": 2, "sp": 1}
SAMPLE_SITES = [("Cairo", 30.04, 31.24), ("Alexandria", 31.20, 29.92),
                ("Aswan", 24.09, 32.90), ("Hurghada", 27.26, 33.81)]
SAMPLE_TIMES = ["2025-01-15T10:00", "2025-07-15T10:00", "2025-07-15T05:00"]


def clean(a, d=2):
    """numpy -> rounded python list with None for NaN."""
    a = np.asarray(a, dtype="float64")
    out = np.round(a, d)
    if a.ndim == 0:
        return None if not np.isfinite(a) else float(out)
    lst = out.tolist()

    def fix(x):
        if isinstance(x, list):
            return [fix(v) for v in x]
        return None if x != x or x in (float("inf"), float("-inf")) else x

    return fix(lst)


def open_one(path):
    ds = xr.open_dataset(path)
    if "valid_time" in ds.dims:
        ds = ds.drop_vars("time", errors="ignore").rename(valid_time="time")
    return ds.drop_vars([c for c in ds.coords if c not in ds.dims])


def convert_da(name, da):
    if name in RADIATION:
        return (da / 3600).clip(min=0)
    if name in KELVIN:
        return da - 273.15
    if name == "sp":
        return da / 100
    return da


def local_index(times):
    return pd.DatetimeIndex(times).tz_localize("UTC").tz_convert(LOCAL_TZ)


# ---------------------------------------------------------------- load
files = [f for f in sorted(DATA_DIR.rglob("*.nc")) if "preprocessed" not in f.parts]
if not files:
    sys.exit(f"No .nc files under {DATA_DIR}")
print(f"{len(files)} files")

report = {"load": {}, "time": {}, "units": {}, "local": {}, "features": {}}
accum, instant = [], []
raw_vars = {"accum": [], "instant": []}
extra_stats = {}          # variables outside CORE: quality numbers only
total_mb = 0.0
for f in files:
    total_mb += f.stat().st_size / 1e6
    ds = open_one(f)
    names = list(ds.data_vars)
    kind = "accum" if set(names) & ACCUM else "instant"
    for n in names:
        if n not in raw_vars[kind]:
            raw_vars[kind].append(n)
    hours = local_index(ds.time.values).hour.values
    keep = (hours >= LOCAL_HOURS[0]) & (hours <= LOCAL_HOURS[1])
    for n in names:
        if n in CORE:
            continue
        v = convert_da(n, ds[n]).values[keep]
        s = extra_stats.setdefault(n, {"min": np.inf, "max": -np.inf, "sum": 0.0, "n": 0, "nan": 0})
        ok = np.isfinite(v)
        if ok.any():
            s["min"] = min(s["min"], float(v[ok].min()))
            s["max"] = max(s["max"], float(v[ok].max()))
            s["sum"] += float(v[ok].sum(dtype="float64"))
        s["n"] += int(ok.sum())
        s["nan"] += int((~ok).sum())
    part = ds[[n for n in names if n in CORE]].astype("float32").load()
    (accum if kind == "accum" else instant).append(part)
    ds.close()

dynamic = []
for parts in (accum, instant):
    d = xr.concat(parts, dim="time", data_vars="all", join="outer", combine_attrs="drop_conflicts")
    dynamic.append(d.sortby("time"))
steps_accum, steps_instant = (int(d.sizes["time"]) for d in dynamic)
ds = xr.merge(dynamic, join="inner", compat="no_conflicts", combine_attrs="drop_conflicts")
ds = ds.sortby(["time", "latitude"])
dup = ds.indexes["time"].duplicated()
if dup.any():
    ds = ds.isel(time=np.flatnonzero(~dup))
del accum, instant, dynamic

lats = ds.latitude.values
lons = ds.longitude.values
report["load"] = {
    "files": len(files), "folders": len({f.parent for f in files}),
    "size_mb": round(total_mb, 1),
    "accum_files": sum(1 for f in files if "accum" in f.name),
    "instant_files": sum(1 for f in files if "instant" in f.name),
    "raw_vars": raw_vars, "steps_accum": steps_accum, "steps_instant": steps_instant,
    "steps_merged": int(ds.sizes["time"]), "duplicates": int(dup.sum()),
    "n_lat": len(lats), "n_lon": len(lons), "cells": len(lats) * len(lons),
    "lat_range": [float(lats.min()), float(lats.max())],
    "lon_range": [float(lons.min()), float(lons.max())],
    "resolution_deg": float(abs(lats[1] - lats[0])),
}

# ---------------------------------------------------------------- time check
t = ds.indexes["time"]
diffs = pd.Series(t).diff().dropna()
vc = diffs.value_counts().head(4)
big = diffs[diffs > pd.Timedelta(hours=24)]
utc_hours = sorted(set(int(h) for h in t.hour))
report["time"] = {
    "start": str(t[0]), "end": str(t[-1]), "steps": len(t),
    "days": int(pd.Series(t.normalize()).nunique()),
    "utc_hours": utc_hours,
    "step_sizes": [{"step_hours": round(k.total_seconds() / 3600, 2), "count": int(v)} for k, v in vc.items()],
    "gaps": [{"after": str(t[i - 1]), "before": str(t[i]),
              "days": round(diffs.loc[i].total_seconds() / 86400, 1)} for i in big.index][:12],
}

# ---------------------------------------------------------------- raw samples (before conversion)
samples = []
for ts in SAMPLE_TIMES:
    for site, la, lo in SAMPLE_SITES[: 2 if ts != SAMPLE_TIMES[1] else 4]:
        try:
            p = ds.sel(time=np.datetime64(ts)).sel(latitude=la, longitude=lo, method="nearest")
        except KeyError:
            continue
        samples.append({"site": site, "time": ts, "lat": float(p.latitude), "lon": float(p.longitude),
                        "raw": {v: clean(p[v].values, 2) for v in ["ssrd", "fdir", "t2m", "u10", "v10", "sp"]}})

# ---------------------------------------------------------------- units
neg = {}
for v in RADIATION:
    if v in ds:
        neg[v] = int((ds[v] < 0).sum())
        ds[v] = (ds[v] / 3600).clip(min=0).astype("float32")
ds["t2m"] = (ds["t2m"] - 273.15).astype("float32")
ds["sp"] = (ds["sp"] / 100).astype("float32")
report["units"] = {
    "negative_clipped": neg,
    "fdir_gt_ssrd": int((ds["fdir"] > ds["ssrd"] + 1).sum()),
    "total_values": int(ds["ssrd"].size),
}

# ---------------------------------------------------------------- local time
idx = local_index(ds.time.values)
hours_all = idx.hour.values
counts = pd.Series(hours_all).value_counts().sort_index()
keep = np.flatnonzero((hours_all >= LOCAL_HOURS[0]) & (hours_all <= LOCAL_HOURS[1]))
report["local"] = {
    "tz": LOCAL_TZ, "window": list(LOCAL_HOURS),
    "steps_before": int(ds.sizes["time"]), "steps_after": int(len(keep)),
    "per_local_hour": [{"hour": int(h), "count": int(c),
                        "kept": bool(LOCAL_HOURS[0] <= h <= LOCAL_HOURS[1])} for h, c in counts.items()],
}
ds = ds.assign_coords(local_hour=("time", hours_all)).isel(time=keep)

# ---------------------------------------------------------------- features
ws = np.hypot(ds["u10"], ds["v10"]).astype("float32")
wd = np.arctan2(-ds["u10"], -ds["v10"])
ds["wind_speed"] = ws
ds["wind_dir_sin"] = np.sin(wd).where(ws > 0).astype("float32")
ds["wind_dir_cos"] = np.cos(wd).where(ws > 0).astype("float32")
del wd
ds["diffuse"] = (ds["ssrd"] - ds["fdir"]).clip(min=0).astype("float32")
ds["clear_sky_index"] = (ds["ssrd"] / ds["ssrdc"]).where(ds["ssrdc"] > 20).astype("float32")
hour = ds.time.dt.hour + ds.time.dt.minute / 60
doy = ds.time.dt.dayofyear
ds["hour_sin"] = np.sin(2 * np.pi * hour / 24)
ds["hour_cos"] = np.cos(2 * np.pi * hour / 24)
ds["doy_sin"] = np.sin(2 * np.pi * (doy - 1) / 365.25)
ds["doy_cos"] = np.cos(2 * np.pi * (doy - 1) / 365.25)
report["features"] = {"added": ["wind_speed", "wind_dir_sin", "wind_dir_cos", "diffuse",
                                "clear_sky_index", "hour_sin", "hour_cos", "doy_sin", "doy_cos"],
                      "rows": int(ds.sizes["time"]) * len(lats) * len(lons),
                      "steps": int(ds.sizes["time"])}

# clean values of the sample rows
for s in samples:
    try:
        p = ds.sel(time=np.datetime64(s["time"])).sel(latitude=s["lat"], longitude=s["lon"])
    except KeyError:
        s["clean"] = None
        continue
    s["local_hour"] = int(p.local_hour)
    s["clean"] = {v: clean(p[v].values, 3 if "sin" in v or "cos" in v or v == "clear_sky_index" else 2)
                  for v in ["ssrd", "fdir", "diffuse", "t2m", "u10", "v10", "wind_speed", "sp",
                            "clear_sky_index", "wind_dir_sin", "wind_dir_cos",
                            "hour_sin", "hour_cos", "doy_sin", "doy_cos"]}

# ---------------------------------------------------------------- quality report
quality = []
for v, da in ds.data_vars.items():
    n_nan = int(da.isnull().sum())
    quality.append({"variable": v, "min": clean(da.min().values, 3), "mean": clean(da.mean().values, 3),
                    "max": clean(da.max().values, 3), "nan": n_nan,
                    "nan_pct": round(100 * n_nan / da.size, 2), "core": True})
for v, s in extra_stats.items():
    tot = s["n"] + s["nan"]
    quality.append({"variable": v, "min": clean(s["min"], 3) if s["n"] else None,
                    "mean": clean(s["sum"] / s["n"], 3) if s["n"] else None,
                    "max": clean(s["max"], 3) if s["n"] else None,
                    "nan": s["nan"], "nan_pct": round(100 * s["nan"] / tot, 2), "core": False})
print("quality done")

# ---------------------------------------------------------------- maps
maps = {"by_month": {}, "by_hour": {}, "mean": {}}
month_groups = ds[MAP_VARS].groupby("time.month").mean()
hour_groups = ds[MAP_VARS].groupby("local_hour").mean()
maps["months"] = [int(m) for m in month_groups.month.values]
maps["hours"] = [int(h) for h in hour_groups.local_hour.values]
for v in MAP_VARS:
    d = DECIMALS[v]
    maps["by_month"][v] = [clean(month_groups[v].sel(month=m).transpose(*SPATIAL).values.ravel(), d)
                           for m in month_groups.month.values]
    maps["by_hour"][v] = [clean(hour_groups[v].sel(local_hour=h).transpose(*SPATIAL).values.ravel(), d)
                          for h in hour_groups.local_hour.values]
    maps["mean"][v] = clean(ds[v].mean("time").transpose(*SPATIAL).values.ravel(), d)
print("maps done")

# ---------------------------------------------------------------- time series
gm = {v: ds[v].mean(SPATIAL) for v in PLOT_VARS}
daily = {}
daily_index = None
for v in PLOT_VARS:
    s = gm[v].to_series().resample("1D").mean()
    daily_index = s.index
    daily[v] = clean(s.values, DECIMALS[v])
weeks = []
for start in ["2024-01-01", "2025-04-01", "2025-07-01", "2025-10-01"]:
    t0 = pd.Timestamp(start)
    t1 = t0 + pd.Timedelta(days=7) - pd.Timedelta(minutes=1)
    sub = ds.sel(time=slice(t0, t1))
    if sub.sizes["time"] == 0:
        continue
    w = {"start": start, "time": [str(x)[:16] for x in sub.time.values],
         "local_hour": [int(h) for h in sub.local_hour.values], "series": {}, "band": {}}
    for v in PLOT_VARS:
        w["series"][v] = clean(gm[v].sel(time=slice(t0, t1)).values, DECIMALS[v])
    for v in ["ssrd", "t2m", "sp", "wind_speed"]:
        q = sub[v].quantile([0.1, 0.9], dim=SPATIAL)
        w["band"][v] = {"lo": clean(q.sel(quantile=0.1).values, DECIMALS[v]),
                        "hi": clean(q.sel(quantile=0.9).values, DECIMALS[v])}
    weeks.append(w)
timeseries = {"dates": [str(d.date()) for d in daily_index], "daily": daily, "weeks": weeks}

# ---------------------------------------------------------------- diurnal
diurnal = {"hours": None, "mean": {}, "std": {}}
for v in ["ssrd", "fdir", "diffuse", "t2m", "wind_speed", "sp"]:
    g = gm[v].groupby("local_hour")
    m, s = g.mean(), g.std()
    diurnal["hours"] = [int(h) for h in m.local_hour.values]
    diurnal["mean"][v] = clean(m.values, DECIMALS[v])
    diurnal["std"][v] = clean(s.values, DECIMALS[v])

# ---------------------------------------------------------------- profiles
profiles = {"lon": clean(lons, 2), "lat": clean(lats, 2), "by_lon": {}, "by_lat": {}}
for v in PLOT_VARS:
    tm = ds[v].mean("time")
    profiles["by_lon"][v] = clean(tm.mean("latitude").values, DECIMALS[v] + 1)
    profiles["by_lat"][v] = clean(tm.mean("longitude").values, DECIMALS[v] + 1)

# ---------------------------------------------------------------- distributions + correlation
rng = np.random.default_rng(0)
size = ds["ssrd"].size
pick = rng.choice(size, size=min(300_000, size), replace=False)
df = pd.DataFrame({c: ds[c].transpose("time", *SPATIAL).values.ravel()[pick] for c in PLOT_VARS})
hists = {}
for c in PLOT_VARS:
    x = df[c].dropna().values
    cnt, edges = np.histogram(x, bins=60)
    hists[c] = {"counts": cnt.tolist(), "min": float(edges[0]), "max": float(edges[-1]),
                "mean": float(x.mean()), "median": float(np.median(x)), "std": float(x.std()),
                "p05": float(np.quantile(x, 0.05)), "p95": float(np.quantile(x, 0.95)),
                "zero_share": float((x <= 1e-6).mean())}
corr = clean(df.corr().values, 3)
distributions = {"sample": int(len(df)), "hist": hists}
correlation = {"vars": PLOT_VARS, "matrix": corr}

out = {
    "generated": pd.Timestamp.now("UTC").strftime("%Y-%m-%d %H:%M UTC"),
    "grid": {"lat": clean(lats, 2), "lon": clean(lons, 2)},
    "report": report, "samples": samples, "quality": quality, "maps": maps,
    "timeseries": timeseries, "diurnal": diurnal, "profiles": profiles,
    "distributions": distributions, "correlation": correlation,
}
OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
OUT_PATH.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
print(f"Saved {OUT_PATH} ({OUT_PATH.stat().st_size / 1e6:.2f} MB)")
print(json.dumps(report, indent=1)[:3000])
