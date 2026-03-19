from uuid import UUID
import os
import random
from sqlmodel import Session, select
from database import engine
from models import Project, Article, ModelAdapter
from gliner2 import GLiNER2
from gliner2.training.trainer import GLiNER2Trainer, TrainingConfig
from gliner2.training.data import InputExample

def train_model_task(
    adapter_id: UUID, 
    epochs: int, 
    batch_size: int, 
    lora_rank: int, 
    lora_alpha: float,
    encoder_lr: float,
    task_lr: float,
    warmup_ratio: float,
    weight_decay: float,
    use_early_stopping: bool
):
    with Session(engine) as session:
        adapter = session.get(ModelAdapter, adapter_id)
        if not adapter: return
        project = session.get(Project, adapter.project_id)
        if not project: return

        try:
            # 1. Prepare Dataset
            articles = session.exec(select(Article).where(Article.project_id == project.id).where(Article.reviewed == True)).all()

            all_examples = []
            for art in articles:
                # Group annotations by label
                entities = {}
                for ann in art.annotations:
                    label = ann.label
                    text = art.content[ann.start:ann.end]
                    if label not in entities:
                        entities[label] = []
                    entities[label].append(text)

                # Format into InputExample
                all_examples.append(InputExample(
                    text=art.content,
                    entities=entities
                ))

            # Simple 90/10 split
            random.seed(42)
            random.shuffle(all_examples)
            split_idx = int(len(all_examples) * 0.9)
            train_examples = all_examples[:split_idx]
            val_examples = all_examples[split_idx:] if split_idx < len(all_examples) else []

            # 2. Configure Training
            adapter_dir = os.path.join("adapters", str(adapter_id))
            os.makedirs(adapter_dir, exist_ok=True)

            config = TrainingConfig(
                output_dir=adapter_dir,
                experiment_name=adapter.name,
                num_epochs=epochs,
                batch_size=batch_size,
                encoder_lr=encoder_lr,
                task_lr=task_lr,
                warmup_ratio=warmup_ratio,
                weight_decay=weight_decay,
                use_lora=True,
                lora_r=lora_rank,
                lora_alpha=lora_alpha,
                early_stopping=use_early_stopping,
                save_adapter_only=True,
                fp16=False,
                logging_steps=10
            )

            # 3. Run Trainer
            model = GLiNER2.from_pretrained(adapter.base_model)
            trainer = GLiNER2Trainer(model=model, config=config)

            results = trainer.train(
                train_data=train_examples,
                eval_data=val_examples if val_examples else None
            )

            # 4. Success
            adapter.status = "completed"
            adapter.adapter_path = os.path.join(adapter_dir, "best" if val_examples else "final")

            # Extract F1 if available from results
            if "eval_f1" in results:
                adapter.f1_score = results["eval_f1"]
            elif "best_metric" in results:
                adapter.f1_score = results["best_metric"]

            session.add(adapter)
            session.commit()

        except Exception as e:
            adapter.status = "error"
            import traceback
            traceback.print_exc()
            session.add(adapter)
            session.commit()
