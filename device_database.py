"""
Device Database - Catalog of known medical devices and their manuals.

This file contains the mapping of manufacturers → models → documentation.
"""

# Directory where downloaded manuals are stored
MANUALS_DIR = "manuals"

DEVICE_DATABASE = {
    "BD Alaris": {
        "models": {
            "8015": {
                "remote": "https://www.bd.com/content/dam/bd-assets/na/medication-management-solutions/documents/instructions-for-use/Alaris-System-8015.pdf",
                "local": "manuals/Alaris-System-8015.pdf"
            }
        }
    },
    "Dräger": {
        "models": {
            "Apollo": {
                "remote": "https://acmerevival.com/wp-content/uploads/2021/08/05-Drager-Apollo-Anesthesia-Machine-Manual.pdf",
                "local": "manuals/05-Drager-Apollo-Anesthesia-Machine-Manual.pdf"
            },
            "Fabius GS": {
                "remote": "https://anesthesia.prescottsmed.com/wp-content/uploads/Fabius-GS-User-Manual.pdf",
                "local": "manuals/Fabius-GS-User-Manual.pdf"
            },
            "Atlan A100": {
                "remote": "https://manuals.plus/m/9ae2363c9f26966d42f01d809e156b1d8c1eca401fbff3f8d4100751947ea0a8.pdf",
                "local": "manuals/Atlan_A_Series_User_Guide.pdf"
            },
            "Atlan A100 XL": {
                "remote": "https://manuals.plus/m/9ae2363c9f26966d42f01d809e156b1d8c1eca401fbff3f8d4100751947ea0a8.pdf",
                "local": "manuals/Atlan_A_Series_User_Guide.pdf"
            },
            "Atlan A300": {
                "remote": "https://manuals.plus/m/9ae2363c9f26966d42f01d809e156b1d8c1eca401fbff3f8d4100751947ea0a8.pdf",
                "local": "manuals/Atlan_A_Series_User_Guide.pdf"
            },
            "Atlan A300 XL": {
                "remote": "https://manuals.plus/m/9ae2363c9f26966d42f01d809e156b1d8c1eca401fbff3f8d4100751947ea0a8.pdf",
                "local": "manuals/Atlan_A_Series_User_Guide.pdf"
            },
            "Atlan A350": {
                "remote": "https://manuals.plus/m/9ae2363c9f26966d42f01d809e156b1d8c1eca401fbff3f8d4100751947ea0a8.pdf",
                "local": "manuals/Atlan_A_Series_User_Guide.pdf"
            },
            "Atlan A350 XL": {
                "remote": "https://manuals.plus/m/9ae2363c9f26966d42f01d809e156b1d8c1eca401fbff3f8d4100751947ea0a8.pdf",
                "local": "manuals/Atlan_A_Series_User_Guide.pdf"
            }
        }
    },
    "GE Healthcare": {
        "models": {
            "B650": {
                "remote": None,
                "local": "manuals/carescape_b650.pdf"
            },
            "Aisys CS2": {
                "remote": "https://sofia.medicalistes.fr/spip/IMG/pdf/aisys_cs2_user_s_reference_manual.pdf",
                "local": "manuals/ge_aisys_cs2.pdf"
            },
            "Aisys": {
                "remote": "https://sofia.medicalistes.fr/spip/IMG/pdf/aisys_cs2_user_s_reference_manual.pdf",
                "local": "manuals/ge_aisys_cs2.pdf"
            },
            "Avance CS2": {
                "remote": "https://www.gehealthcare.co.uk/-/jssmedia/800e8e7c4d914087a585f76d04cc0a69.pdf",
                "local": "manuals/ge_avance_cs2.pdf"
            },
            "Avance": {
                "remote": "https://www.gehealthcare.co.uk/-/jssmedia/800e8e7c4d914087a585f76d04cc0a69.pdf",
                "local": "manuals/ge_avance_cs2.pdf"
            }
        }
    },
    "Mindray": {
        "models": {
            "EX65": {
                "remote": None,
                "local": "manuals/mindray_wato_ex65.pdf"
            }
        }
    },
    "Baxter": {
        "models": {
            "AS50": {
                "remote": None,
                "local": "manuals/Baxter-AS50-Operators-Manual.pdf"
            },
            "A50": {
                "remote": None,
                "local": "manuals/Baxter-AS50-Operators-Manual.pdf"
            }
        }
    }
}


def get_manufacturers():
    """Returns list of all manufacturer names."""
    return list(DEVICE_DATABASE.keys())


def get_models(manufacturer: str):
    """Returns list of model names for a manufacturer."""
    if manufacturer not in DEVICE_DATABASE:
        return []
    return list(DEVICE_DATABASE[manufacturer]["models"].keys())


def get_model_docs(manufacturer: str, model: str):
    """
    Looks up the documentation info for a device model.
    Returns dict with 'remote' and 'local' keys, or None if not found.
    """
    # Try by manufacturer first
    if manufacturer in DEVICE_DATABASE:
        model_data = DEVICE_DATABASE[manufacturer]["models"].get(model)
        if model_data:
            return model_data
    
    # Fallback: search all manufacturers
    for mfr_data in DEVICE_DATABASE.values():
        if model in mfr_data["models"]:
            return mfr_data["models"][model]
    
    return None

