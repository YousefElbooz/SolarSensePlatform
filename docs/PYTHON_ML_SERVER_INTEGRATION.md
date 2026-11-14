# Python ML Server Integration & 23-Feature Contract

This document defines the exact request/response contract between the **SolarSense Platform** (`/` · `/twin` · `/predict`) and the external **Python ML Inference Service** (`PYTHON_ML_SERVICE_URL`).

---

## 1. Architecture Overview

SolarSense exposes two API routes in Next.js:

1. **`GET /api/weather`** — Fetches hourly meteorological variables from Open-Meteo (`forecast`, `recent`, or `archive`), converts them to the exact units of the ERA5 + PVGIS training dataset, computes clear-sky reference irradiance (`GHI_cs`, `BHI_cs`, `DHI_cs`, `BNI_cs`) and clearness index (`kt`), fills non-API features from `public/data/feature_defaults.json`, and returns per-feature provenance tags (`"api"`, `"calculated"`, `"default"`).
2. **`POST /api/predict`** — Validates all 23 features, categorical inputs (`Region`, `PV_Technology`), and timestamp (`date`, `hour`), then:
   - If `PYTHON_ML_SERVICE_URL` is configured and reachable, forwards the 23-feature payload to `{PYTHON_ML_SERVICE_URL}/predict` (`source: "model"`).
   - Otherwise, evaluates the Faiman + PVWatts physics stand-in equation and returns `source: "stand-in"` (without any fake model name or version).

---

## 2. The 23 Model Features (Dataset Units)

Every prediction request carries all 23 meteorological features in dataset units:

| # | Key | Form Unit | Dataset Unit (sent to `/api/predict`) | Conversion (`Form → Dataset`) | Typical Source in Map Mode |
|---|---|---|---|---|---|
| 1 | `GHI` | `W/m²` | `J/m²` | `× 3600` | `api` (`shortwave_radiation`) |
| 2 | `BHI` | `W/m²` | `J/m²` | `× 3600` | `calculated` (`GHI - DHI`) |
| 3 | `DHI` | `W/m²` | `J/m²` | `× 3600` | `api` (`diffuse_radiation`) |
| 4 | `BNI` | `W/m²` | `J/m²` | `× 3600` | `api` (`direct_normal_irradiance`) |
| 5 | `GHI_cs` | `W/m²` | `J/m²` | `× 3600` | `calculated` (Ineichen-Perez clear-sky) |
| 6 | `BHI_cs` | `W/m²` | `J/m²` | `× 3600` | `calculated` |
| 7 | `DHI_cs` | `W/m²` | `J/m²` | `× 3600` | `calculated` |
| 8 | `BNI_cs` | `W/m²` | `J/m²` | `× 3600` | `calculated` |
| 9 | `kt` | `0–1.2` | `0–1.2` | identity (`GHI / GHI_cs`) | `calculated` |
| 10 | `t2m` | `°C` | `K` | `+ 273.15` | `api` (`temperature_2m`) |
| 11 | `d2m` | `°C` | `K` | `+ 273.15` | `api` (`dew_point_2m`) |
| 12 | `stl1` | `°C` | `K` | `+ 273.15` | `api` (`soil_temperature_0_to_7cm`) or `default` |
| 13 | `u10` | `m/s` | `m/s` | `-ws · sin(wd)` | `calculated` from `wind_speed_10m`, `wind_direction_10m` |
| 14 | `v10` | `m/s` | `m/s` | `-ws · cos(wd)` | `calculated` from `wind_speed_10m`, `wind_direction_10m` |
| 15 | `sp` | `hPa` | `Pa` | `× 100` | `api` (`surface_pressure`) |
| 16 | `tp` | `mm` | `m` | `÷ 1000` | `api` (`precipitation`) |
| 17 | `tcwv` | `kg/m²` | `kg/m²` | identity | `default` (`feature_defaults.json`) |
| 18 | `swvl1` | `m³/m³` | `m³/m³` | identity | `api` (`soil_moisture_0_to_7cm`) or `default` |
| 19 | `tcc` | `%` | `0–1` | `÷ 100` | `api` (`cloud_cover`) |
| 20 | `hcc` | `%` | `0–1` | `÷ 100` | `api` (`cloud_cover_high`) |
| 21 | `mcc` | `%` | `0–1` | `÷ 100` | `api` (`cloud_cover_mid`) |
| 22 | `lcc` | `%` | `0–1` | `÷ 100` | `api` (`cloud_cover_low`) |
| 23 | `fal` | `0–1` | `0–1` | identity | `default` (regional albedo) |

---

## 3. Categorical & Temporal Inputs

- **`Region`**: One of the 5 saved regions defined in [`src/domain/regions.config.ts`](../src/domain/regions.config.ts):
  - `"aswan_benban"`
  - `"cairo_delta"`
  - `"alexandria_coast"`
  - `"red_sea_hurghada"`
  - `"western_oasis"`
- **`PV_Technology`**: One of:
  - `"pc-Si"` (Polycrystalline Silicon, $\gamma = -0.41\%/^\circ\text{C}$)
  - `"a-Si:H/sc-Si"` (Silicon Heterojunction / HIT, $\gamma = -0.26\%/^\circ\text{C}$)
  - `"CIGS"` (Copper Indium Gallium Selenide, $\gamma = -0.35\%/^\circ\text{C}$)
- **`date`**: `"YYYY-MM-DD"` (UTC date)
- **`hour`**: Integer `0`..`23` (UTC hour)

---

## 4. `POST /api/predict` Contract

### Request Body

```json
{
  "features": {
    "GHI": 3528000,
    "BHI": 3042000,
    "DHI": 486000,
    "BNI": 3276000,
    "GHI_cs": 3672000,
    "BHI_cs": 3240000,
    "DHI_cs": 432000,
    "BNI_cs": 3456000,
    "kt": 0.9608,
    "t2m": 313.15,
    "d2m": 281.15,
    "stl1": 317.15,
    "u10": -1.3,
    "v10": -3.57,
    "sp": 100900,
    "tp": 0,
    "tcwv": 14.2,
    "swvl1": 0.04,
    "tcc": 0.05,
    "hcc": 0.02,
    "mcc": 0.02,
    "lcc": 0.01,
    "fal": 0.30
  },
  "categorical": {
    "Region": "aswan_benban",
    "PV_Technology": "a-Si:H/sc-Si"
  },
  "timestamp": {
    "date": "2024-06-21",
    "hour": 10
  }
}
```

### Response Body (When Python ML Service Responds)

```json
{
  "predictedValue": 742.5,
  "unit": "W/kWp",
  "source": "model",
  "modelName": "XGBoost-PV-Egypt",
  "modelVersion": "v2.1",
  "physicsReference": {
    "value": 731.8,
    "unit": "W/kWp",
    "equation": "P = G_h * [1 + gamma * (T_cell - 25)] * (1 - L_sys)"
  },
  "warnings": []
}
```

### Response Body (When `PYTHON_ML_SERVICE_URL` is Unset — Physics Stand-In)

Note that `"stand-in"` **never** carries a `modelName` or `modelVersion`:

```json
{
  "predictedValue": 731.8,
  "unit": "W/kWp",
  "source": "stand-in",
  "physicsReference": {
    "value": 731.8,
    "unit": "W/kWp",
    "equation": "P = G_h * [1 + gamma * (T_cell - 25)] * (1 - L_sys)"
  },
  "warnings": []
}
```

---

## 5. FastAPI Reference Server (`server.py`)

```python
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Dict, List, Optional

app = FastAPI(title="SolarSense 23-Feature ML Inference Service")

class CategoricalInput(BaseModel):
    Region: str
    PV_Technology: str

class TimestampInput(BaseModel):
    date: str
    hour: int

class PredictRequest(BaseModel):
    features: Dict[str, float]
    categorical: CategoricalInput
    timestamp: TimestampInput

@app.post("/predict")
def predict(req: PredictRequest):
    # Replace with your trained LightGBM / XGBoost / CatBoost pipeline:
    # X = build_dataframe(req.features, req.categorical, req.timestamp)
    # y_hat = float(model.predict(X)[0])
    ghi_wm2 = req.features["GHI"] / 3600.0
    t_amb_c = req.features["t2m"] - 273.15
    y_hat = max(0.0, ghi_wm2 * (1.0 - 0.0026 * max(0.0, t_amb_c - 25.0)) * 0.85)
    return {
        "predictedValue": round(y_hat, 2),
        "unit": "W/kWp",
        "modelName": "SolarSense-ML",
        "modelVersion": "1.0.0",
        "warnings": [],
    }
```

Set `PYTHON_ML_SERVICE_URL=http://localhost:8000` in `.env.local` (or Vercel Environment Variables) to switch `/api/predict` from `"stand-in"` to `"model"`.
