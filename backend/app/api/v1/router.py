from fastapi import APIRouter

from . import (
    agent,
    classification,
    forecast,
    ingest,
    kpis,
    materials,
    network,
    opportunities,
    plants,
    recommendations,
    simulation,
    wizard,
    workflow,
)

api_router = APIRouter()
api_router.include_router(plants.router)
api_router.include_router(materials.router)
api_router.include_router(recommendations.router)
api_router.include_router(kpis.router)
api_router.include_router(forecast.router)
api_router.include_router(opportunities.router)
api_router.include_router(classification.router)
api_router.include_router(simulation.router)
api_router.include_router(wizard.router)
api_router.include_router(network.router)
api_router.include_router(agent.router)
api_router.include_router(ingest.router)
api_router.include_router(workflow.router)
