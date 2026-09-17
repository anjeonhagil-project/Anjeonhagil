// 기능: 전달받은 팀 모델의 숫자 계수·스케일러·XGBoost를 실행 가능한 묶음으로 반입한다. 합성 데이터 출처를 보존한다.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
const input = resolve(process.argv[2] || '.test-tools/integration-inputs/models/XGBoostTEST')
const output = resolve('ml/bundled')
mkdirSync(output, { recursive: true })
const csv = readFileSync(join(input, 'Comparison/logistic_revised/coefficients.csv'), 'utf8').trim().split(/\r?\n/).slice(1).map(line => line.split(','))
const metrics = JSON.parse(readFileSync(join(input, 'final_model/final_test_metrics.json'), 'utf8'))
const comparison = JSON.parse(readFileSync(join(input, 'Comparison/model_comparison.json'), 'utf8'))
const bundle = {
    model_version: 'logistic_synthetic_20260916', scaler_version: 'train_standard_deviation_20260916',
    training_source: 'SYNTHETIC_TEAM_DATA', real_user_validated: false,
    feature_order: csv.map(row => row[0]), coefficients: csv.map(row => Number(row[1])),
    scales: csv.map(row => Number(row[2])), intercept: 0, with_mean: false,
    feature_version: 'static_burden_v5_child_circle_inside', contract_version: 'anjeon_contract_v6_child100', eta_version: 'internal_hourly_topis_v1',
    probability: '(p(x)+1-p(-x))/2', ranking: 'probability_sum',
    test_metrics: metrics.test, validation_comparison: comparison.models,
    source_artifact_sha256: createHash('sha256').update(readFileSync(join(input, 'Comparison/logistic_revised/logistic_model.joblib'))).digest('hex'),
}
if (csv.length !== 8 || bundle.scales.some(x => !Number.isFinite(x) || x <= 0)) throw new Error('Invalid model feature schema')
writeFileSync(join(output, 'logistic.json'), JSON.stringify(bundle, null, 2) + '\n')
copyFileSync(join(input, 'xgb_pairwise_demo/final_data/final_xgboost/xgb_model.json'), join(output, 'xgboost.json'))
const xm = JSON.parse(readFileSync(join(input, 'xgb_pairwise_demo/final_data/final_xgboost/metadata.json'), 'utf8'))
delete xm.data_file
writeFileSync(join(output, 'xgboost-metadata.json'), JSON.stringify({ ...xm, training_source: 'SYNTHETIC_TEAM_DATA', model_version: 'xgboost_comparison_20260916' }, null, 2) + '\n')
console.log('Imported team Logistic coefficients/scaler and XGBoost comparison model.')
