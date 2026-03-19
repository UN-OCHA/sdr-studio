DEFAULT_CONFIG = {
    "model_id": "fastino/gliner2-base-v1",
    "summary_model_id": "sshleifer/distilbart-cnn-12-6",
    "threshold": 0.3,
    "cleaning": {
        "use_local_model": False,
        "model_id": "fastino/gliner2-base-v1"
    },
    "entities": {
        "Location": "Geographic locations mentioned",
        "Date": "Dates or time references",
        "Population impact": "Impact on people (deaths, injuries, displaced)",
        "Infrastructure impact": "Damage to buildings, roads, etc.",
        "Hazard descriptor": "Type of disaster (cyclone, flood, etc.)",
        "Event name": "Specific name of the event",
        "Organization": "Relief groups, government agencies"
    },
    "relations": {
        "impacts": "Hazard impacts a specific location",
        "occurred_in": "Event occurred in a location",
        "reported_by": "Information reported by an organization",
        "associated_with": "Two entities are related in some way"
    },
    "classifications": {
        "Severity": {
            "labels": ["Low", "Medium", "High", "Critical"],
            "multi_label": False,
            "threshold": 0.5
        }
    }
}
