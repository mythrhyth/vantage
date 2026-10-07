-- CreateTable
CREATE TABLE "portfolios" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "baseline_value" DECIMAL(65,30) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "portfolio_id" UUID NOT NULL,
    "ticker" TEXT,
    "company" TEXT,
    "asset_type" TEXT NOT NULL,
    "sector" TEXT,
    "current_weight" DECIMAL(65,30) NOT NULL,
    "sentiment" DECIMAL(65,30) NOT NULL,
    "base_sentiment" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_events" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sentiment" DECIMAL(65,30) NOT NULL,
    "impact" DECIMAL(65,30) NOT NULL,
    "entity" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "horizon" TEXT NOT NULL,
    "classification_reason" TEXT,
    "signals" JSONB NOT NULL,
    "sentiment_drivers" JSONB NOT NULL,
    "impact_factors" JSONB NOT NULL,
    "affected_areas" JSONB NOT NULL,
    "risk_flow" JSONB NOT NULL,
    "excerpt" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenarios" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "spread" DECIMAL(65,30) NOT NULL,
    "probability" DECIMAL(65,30) NOT NULL,
    "liquidity" DECIMAL(65,30) NOT NULL,
    "inflation" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stress_test_runs" (
    "id" UUID NOT NULL,
    "portfolio_id" UUID NOT NULL,
    "scenario_id" UUID,
    "event_id" UUID,
    "parameters_used" JSONB NOT NULL,
    "baseline_value" DECIMAL(65,30) NOT NULL,
    "stressed_value" DECIMAL(65,30) NOT NULL,
    "absolute_loss" DECIMAL(65,30) NOT NULL,
    "risk_score" DECIMAL(65,30) NOT NULL,
    "attribution_result" JSONB NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stress_test_runs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stress_test_runs" ADD CONSTRAINT "stress_test_runs_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stress_test_runs" ADD CONSTRAINT "stress_test_runs_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stress_test_runs" ADD CONSTRAINT "stress_test_runs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "risk_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
