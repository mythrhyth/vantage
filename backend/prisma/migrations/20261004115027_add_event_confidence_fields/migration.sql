-- AlterTable
ALTER TABLE "risk_events" ADD COLUMN     "classification_confidence" DECIMAL(65,30),
ADD COLUMN     "impact_confidence" DECIMAL(65,30),
ADD COLUMN     "impact_reason" TEXT,
ADD COLUMN     "sentiment_confidence" DECIMAL(65,30);
