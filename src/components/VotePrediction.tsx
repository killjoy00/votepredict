import type { VotePredictionResult } from '../types/index.js'

interface Props {
  result: VotePredictionResult
}

function VoteBar({
  yes, no, abstain, uncertain, total, label,
}: {
  yes: number; no: number; abstain: number; uncertain: number; total: number; label: string
}) {
  if (total === 0) return null
  const majority = Math.floor(total / 2) + 1
  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`

  return (
    <div className="mb-5">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="font-semibold text-sm text-gray-800">{label}</span>
        <span className="text-xs text-gray-400">{total} members · {majority} to pass</span>
      </div>

      {/* Bar */}
      <div className="flex rounded-full overflow-hidden h-9 bg-gray-100 shadow-inner">
        {yes > 0 && (
          <div
            style={{ width: pct(yes) }}
            className="bg-green-500 flex items-center justify-center text-white text-xs font-bold transition-all"
            title={`Yes: ${yes}`}
          >
            {yes >= 8 ? yes : ''}
          </div>
        )}
        {uncertain > 0 && (
          <div
            style={{ width: pct(uncertain) }}
            className="bg-slate-400 flex items-center justify-center text-white text-xs font-bold transition-all"
            title={`Uncertain: ${uncertain}`}
          >
            {uncertain >= 8 ? uncertain : ''}
          </div>
        )}
        {abstain > 0 && (
          <div
            style={{ width: pct(abstain) }}
            className="bg-yellow-400 flex items-center justify-center text-white text-xs font-bold transition-all"
            title={`Abstain: ${abstain}`}
          >
            {abstain >= 8 ? abstain : ''}
          </div>
        )}
        {no > 0 && (
          <div
            style={{ width: pct(no) }}
            className="bg-red-500 flex items-center justify-center text-white text-xs font-bold transition-all"
            title={`No: ${no}`}
          >
            {no >= 8 ? no : ''}
          </div>
        )}
      </div>

      {/* Majority line indicator */}
      <div className="relative h-1 mt-0.5">
        <div
          style={{ left: `${(majority / total) * 100}%` }}
          className="absolute top-0 w-px h-3 bg-gray-400 -translate-x-px"
          title={`Majority: ${majority}`}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2">
        <span className="flex items-center gap-1 text-xs text-gray-600">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" /> Yes: <strong>{yes}</strong>
        </span>
        {abstain > 0 && (
          <span className="flex items-center gap-1 text-xs text-gray-600">
            <span className="w-2.5 h-2.5 rounded-sm bg-yellow-400 inline-block" /> Abstain: <strong>{abstain}</strong>
          </span>
        )}
        {uncertain > 0 && (
          <span className="flex items-center gap-1 text-xs text-gray-600">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-400 inline-block" /> Uncertain: <strong>{uncertain}</strong>
          </span>
        )}
        <span className="flex items-center gap-1 text-xs text-gray-600">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> No: <strong>{no}</strong>
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <span className="w-px h-3 bg-gray-400 inline-block" /> Majority ({majority})
        </span>
      </div>
    </div>
  )
}

export default function VotePrediction({ result }: Props) {
  const houseTotal = result.houseYes + result.houseNo + result.houseAbstain + result.houseUncertain
  const senateTotal = result.senateYes + result.senateNo + result.senateAbstain + result.senateUncertain

  return (
    <div className="space-y-5">
      {/* Title + verdict */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900 leading-tight">{result.billTitle}</h3>
          {result.billNumber && (
            <span className="text-xs text-gray-400">{result.billNumber}</span>
          )}
        </div>
        <div className={`shrink-0 text-center px-3 py-2 rounded-xl ${
          result.likelyToPass
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'
        }`}>
          <p className="font-bold text-sm leading-tight">
            {result.likelyToPass ? 'LIKELY PASSES' : 'LIKELY FALLS SHORT'}
          </p>
          <p className="text-xs opacity-75 mt-0.5">{result.passageConfidence}% confidence</p>
        </div>
      </div>

      {/* Vote bars */}
      <div className="bg-gray-50 rounded-xl p-4">
        <VoteBar
          yes={result.houseYes}
          no={result.houseNo}
          abstain={result.houseAbstain}
          uncertain={result.houseUncertain}
          total={houseTotal}
          label="Minnesota House"
        />
        <VoteBar
          yes={result.senateYes}
          no={result.senateNo}
          abstain={result.senateAbstain}
          uncertain={result.senateUncertain}
          total={senateTotal}
          label="Minnesota Senate"
        />
      </div>

      {/* AI Analysis */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-1.5">Analysis</h4>
        <p className="text-sm text-gray-600 leading-relaxed">{result.analysis}</p>
      </div>

      {/* Key factors */}
      {result.keyFactors.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-1.5">Key Factors</h4>
          <ul className="space-y-1">
            {result.keyFactors.map((f, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-600">
                <span className="text-blue-400 shrink-0 mt-0.5">•</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="text-xs text-gray-500 bg-slate-50 rounded-lg p-3">
        <summary className="font-semibold text-gray-700 cursor-pointer">How this estimate is calculated</summary>
        <p className="mt-2 leading-relaxed">{result.methodology}</p>
      </details>

      {/* Footer */}
      <div className="text-xs text-gray-400 pt-1 border-t border-gray-100 leading-relaxed">
        Generated {new Date(result.generatedAt).toLocaleString()} · Select a member for individual reasoning.
        <br />
        This is an AI estimate, not a poll, whip count, or statement by any legislator.
      </div>
    </div>
  )
}
