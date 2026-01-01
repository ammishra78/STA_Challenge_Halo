"""
Device Database - Catalog of known medical devices and their manuals.

This file contains the mapping of manufacturers → models → documentation.
Each device includes a "type" field for categorization.
"""

# Directory where downloaded manuals are stored
MANUALS_DIR = "manuals"

# Supported device types - add new types here as needed
DEVICE_TYPES = [
    "Anesthesia Machine",
    "Standalone Ventilator",
    "Infusion Pump",
    "Patient Monitor",
]

DEVICE_DATABASE = {
    "BD Alaris": {
        "models": {
            "8015": {
                "type": "Infusion Pump",
                "remote": "https://www.bd.com/content/dam/bd-assets/na/medication-management-solutions/documents/instructions-for-use/Alaris-System-8015.pdf",
                "local": "manuals/Alaris-System-8015.pdf"
            }
        }
    },
    "Dräger": {
        "models": {
            "Apollo": {
                "type": "Anesthesia Machine",
                "remote": "https://acmerevival.com/wp-content/uploads/2021/08/05-Drager-Apollo-Anesthesia-Machine-Manual.pdf",
                "local": "manuals/05-Drager-Apollo-Anesthesia-Machine-Manual.pdf"
            },
            "Fabius GS": {
                "type": "Anesthesia Machine",
                "remote": "https://anesthesia.prescottsmed.com/wp-content/uploads/Fabius-GS-User-Manual.pdf",
                "local": "manuals/Fabius-GS-User-Manual.pdf"
            },
            "Atlan A100": {
                "type": "Anesthesia Machine",
                "remote": "https://manuals.plus/m/9ae2363c9f26966d42f01d809e156b1d8c1eca401fbff3f8d4100751947ea0a8.pdf",
                "local": "manuals/Atlan_A_Series_User_Guide.pdf"
            },
            "Atlan A100 XL": {
                "type": "Anesthesia Machine",
                "remote": "https://manuals.plus/m/9ae2363c9f26966d42f01d809e156b1d8c1eca401fbff3f8d4100751947ea0a8.pdf",
                "local": "manuals/Atlan_A_Series_User_Guide.pdf"
            },
            "Atlan A300": {
                "type": "Anesthesia Machine",
                "remote": "https://manuals.plus/m/9ae2363c9f26966d42f01d809e156b1d8c1eca401fbff3f8d4100751947ea0a8.pdf",
                "local": "manuals/Atlan_A_Series_User_Guide.pdf"
            },
            "Atlan A300 XL": {
                "type": "Anesthesia Machine",
                "remote": "https://manuals.plus/m/9ae2363c9f26966d42f01d809e156b1d8c1eca401fbff3f8d4100751947ea0a8.pdf",
                "local": "manuals/Atlan_A_Series_User_Guide.pdf"
            },
            "Atlan A350": {
                "type": "Anesthesia Machine",
                "remote": "https://manuals.plus/m/9ae2363c9f26966d42f01d809e156b1d8c1eca401fbff3f8d4100751947ea0a8.pdf",
                "local": "manuals/Atlan_A_Series_User_Guide.pdf"
            },
            "Atlan A350 XL": {
                "type": "Anesthesia Machine",
                "remote": "https://manuals.plus/m/9ae2363c9f26966d42f01d809e156b1d8c1eca401fbff3f8d4100751947ea0a8.pdf",
                "local": "manuals/Atlan_A_Series_User_Guide.pdf"
            }
        }
    },
    "GE Healthcare": {
        "models": {
            "B650": {
                "type": "Patient Monitor",
                "remote": None,
                "local": "manuals/carescape_b650.pdf"
            },
            "Aisys CS2": {
                "type": "Anesthesia Machine",
                "remote": "https://sofia.medicalistes.fr/spip/IMG/pdf/aisys_cs2_user_s_reference_manual.pdf",
                "local": "manuals/aisys_cs2_user_s_reference_manual.pdf"
            },
            "Avance CS2": {
                "type": "Anesthesia Machine",
                "remote": "https://www.gehealthcare.co.uk/-/jssmedia/800e8e7c4d914087a585f76d04cc0a69.pdf",
                "local": "manuals/ge_avance_cs2.pdf"
            },
            "Avance": {
                "type": "Anesthesia Machine",
                "remote": "https://www.gehealthcare.co.uk/-/jssmedia/800e8e7c4d914087a585f76d04cc0a69.pdf",
                "local": "manuals/ge_avance_cs2.pdf"
            }
        }
    },
    "Baxter": {
        "models": {
            "AS50": {
                "type": "Infusion Pump",
                "remote": None,
                "local": "manuals/Baxter-AS50-Operators-Manual.pdf"
            },
            "A50": {
                "type": "Infusion Pump",
                "remote": None,
                "local": "manuals/Baxter-AS50-Operators-Manual.pdf"
            }
        }
    }
}


def get_device_types():
    """Returns list of all supported device types."""
    return DEVICE_TYPES.copy()


def get_manufacturers():
    """Returns list of all manufacturer names."""
    return list(DEVICE_DATABASE.keys())


def get_models(manufacturer: str):
    """Returns list of model names for a manufacturer."""
    if manufacturer not in DEVICE_DATABASE:
        return []
    return list(DEVICE_DATABASE[manufacturer]["models"].keys())


def get_model_info(manufacturer: str, model: str):
    """
    Looks up full device info including type, remote, and local.
    Returns dict with 'type', 'remote', and 'local' keys, or None if not found.
    """
    if manufacturer in DEVICE_DATABASE:
        model_data = DEVICE_DATABASE[manufacturer]["models"].get(model)
        if model_data:
            return model_data
    
    # Fallback: search all manufacturers
    for mfr_data in DEVICE_DATABASE.values():
        if model in mfr_data["models"]:
            return mfr_data["models"][model]
    
    return None


def get_model_docs(manufacturer: str, model: str):
    """
    Looks up the documentation info for a device model.
    Returns dict with 'remote' and 'local' keys, or None if not found.
    (Wrapper around get_model_info for backwards compatibility)
    """
    return get_model_info(manufacturer, model)


def get_devices_by_type(device_type: str):
    """
    Returns all devices of a specific type.
    
    Returns:
        list of dicts: [{"manufacturer": "...", "model": "...", "docs": {...}}, ...]
    """
    devices = []
    for manufacturer, mfr_data in DEVICE_DATABASE.items():
        for model, model_data in mfr_data["models"].items():
            if model_data.get("type") == device_type:
                devices.append({
                    "manufacturer": manufacturer,
                    "model": model,
                    "type": device_type,
                    "local": model_data.get("local"),
                    "remote": model_data.get("remote")
                })
    return devices


def get_all_devices_grouped_by_type():
    """
    Returns all devices grouped by their type.
    
    Returns:
        dict: {"Anesthesia Machine": [...], "Infusion Pump": [...], ...}
    """
    grouped = {device_type: [] for device_type in DEVICE_TYPES}
    
    for manufacturer, mfr_data in DEVICE_DATABASE.items():
        for model, model_data in mfr_data["models"].items():
            device_type = model_data.get("type", "Unknown")
            if device_type not in grouped:
                grouped[device_type] = []
            grouped[device_type].append({
                "manufacturer": manufacturer,
                "model": model,
                "local": model_data.get("local"),
                "remote": model_data.get("remote")
            })
    
    return grouped

