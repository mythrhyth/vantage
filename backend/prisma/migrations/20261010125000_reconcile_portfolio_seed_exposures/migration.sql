WITH asset_exposures AS (
  SELECT
    p.id AS portfolio_id,
    p.baseline_value,
    a.id AS asset_id,
    COALESCE(
      a.exposure_value,
      CASE
        WHEN a.current_weight > 1 THEN a.current_weight / 100
        ELSE a.current_weight
      END * p.baseline_value
    ) AS exposure_value
  FROM portfolios p
  JOIN assets a ON a.portfolio_id = p.id
),
portfolio_totals AS (
  SELECT
    portfolio_id,
    MAX(baseline_value) AS baseline_value,
    SUM(exposure_value) AS total_exposure
  FROM asset_exposures
  GROUP BY portfolio_id
  HAVING SUM(exposure_value) > 0
     AND ABS(SUM(exposure_value) - MAX(baseline_value)) > 1
)
UPDATE assets a
SET
  exposure_value = e.exposure_value * t.baseline_value / t.total_exposure,
  current_weight = e.exposure_value / t.total_exposure
FROM asset_exposures e
JOIN portfolio_totals t ON t.portfolio_id = e.portfolio_id
WHERE a.id = e.asset_id;
