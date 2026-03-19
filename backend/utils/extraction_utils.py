from typing import Dict, Any
from gliner2 import RegexValidator

def build_gliner_schema(extractor, config: Dict[str, Any]):
    schema = extractor.create_schema()
    
    entities = config.get("entities", {})
    if entities:
        if isinstance(entities, list):
            schema = schema.entities(entities)
        elif isinstance(entities, dict):
            # GLiNER2 library handles dict of dicts too
            schema = schema.entities(entities)
    
    relations = config.get("relations", {})
    if relations:
        schema = schema.relations(relations)
    
    classifications = config.get("classifications", {})
    for name, class_config in classifications.items():
        if isinstance(class_config, list):
            # Legacy support for simple list of labels
            schema = schema.classification(name, class_config)
        elif isinstance(class_config, dict):
            labels = class_config.get("labels", [])
            multi_label = class_config.get("multi_label", False)
            threshold = class_config.get("threshold", 0.5)
            schema = schema.classification(
                name, 
                labels, 
                multi_label=multi_label, 
                cls_threshold=threshold
            )
        
    structures = config.get("structures", [])
    for struct in structures:
        s = schema.structure(struct["name"])
        for field in struct.get("fields", []):
            validators = []
            if field.get("validator_pattern"):
                # Always use 'partial' mode as it is safer for extraction-only fields
                validators.append(RegexValidator(field["validator_pattern"], mode="partial"))
            
            s = s.field(
                field["name"], 
                dtype=field.get("dtype", "str"),
                choices=field.get("choices"),
                description=field.get("description"),
                threshold=field.get("threshold"),
                validators=validators
            )
    return schema
