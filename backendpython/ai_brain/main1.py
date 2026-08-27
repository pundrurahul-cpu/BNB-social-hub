from fastapi import FastAPI
from pydantic import BaseModel
import random

app = FastAPI()

class StrategyRequest(BaseModel):
    client_id: str
    month: int
    year: int
    previous_topics: list[str]

@app.post("/analyze-uniqueness")
async def analyze_uniqueness(req: StrategyRequest):
    # In a real setup, we would use 'Sentence-Transformers' here
    # to compare text similarity. For now, we provide the logic gate.
    return {"status": "unique", "similarity_score": 0.0}

@app.get("/health")
def health():
    return {"status": "active"}