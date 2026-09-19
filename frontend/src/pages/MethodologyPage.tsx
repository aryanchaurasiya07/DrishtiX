import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import {
  AlertTriangle,
  TrendingUp,
  Clock,
  Copy,
  Scale,
  BookOpen,
} from 'lucide-react';

const DETECTOR_CARDS = [
  {
    id: 'cost',
    Icon: TrendingUp,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-50 border-blue-100',
    title: 'Cost Outlier Detector',
    weight: '40%',
    what: 'Computes a MAD-based deviation score for each sanctioned amount against the state-and-work-type median. Works with deviation > 3x MAD are flagged.',
    baseline: 'State-level baseline per (work type, state) cell, with national fallback when fewer than 20 works exist in a cell.',
    cannotCatch: [
      'Correctly-priced kickbacks (market-rate bribe built into the bid)',
      'Quality substitution (full price paid, inferior materials delivered)',
      'Works where the entire state is systematically inflated',
    ],
  },
  {
    id: 'duplicate',
    Icon: Copy,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50 border-amber-100',
    title: 'Duplicate / Template Work Detector',
    weight: '30%',
    what: 'Encodes every work description using Sentence-BERT (all-MiniLM-L6-v2), then computes pairwise cosine similarity within each district. Works with similarity > 0.90 are flagged.',
    baseline: 'Two tiers: Tier 1 = high similarity + amount within 5% (possible split tendering). Tier 2 = high similarity + amount differs (possible boilerplate copy).',
    cannotCatch: [
      'Ghost works (fabricated descriptions that are unique enough to stay below threshold)',
      'Collusion across districts (similarity only computed within-district)',
      'Duplicate works with slightly paraphrased descriptions',
    ],
  },
  {
    id: 'delay',
    Icon: Clock,
    iconColor: 'text-rose-600',
    iconBg: 'bg-rose-50 border-rose-100',
    title: 'Aging / Delay Detector',
    weight: '30%',
    what: 'Uses Kaplan-Meier survival analysis (lifelines library) to estimate the true median completion time per work category, correcting for right-censoring bias. Ongoing works open for > 1.75x the KM median for their category are flagged.',
    baseline: '1.75x KM median per category (configurable via DELAY_MULTIPLIER env variable). Right-censoring correction ensures ongoing works are not treated as "bad data".',
    cannotCatch: [
      'Completed works done poorly but on time',
      'Works stalled due to policy changes (flagged regardless of reason)',
      'Geographic factors like monsoon or terrain not accounted for in baseline',
    ],
  },
  {
    id: 'rules',
    Icon: Scale,
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-50 border-purple-100',
    title: 'Statutory Rules Engine',
    weight: 'Hard override',
    what: 'Three hard-coded MPLADS norms: (1) Per-MP annual sanction cap of Rs 5 crore; (2) Category cost ceiling at the 95th percentile; (3) Hard timeline breach at 2x KM median. Rule violations force a minimum Amber band.',
    baseline: 'Rules are deterministic, not statistical. The annual cap and category ceiling thresholds are fixed by MPLADS guidelines.',
    cannotCatch: [
      'Fund diversion to off-system accounts (no tender or payment data available)',
      'Rule-compliant arrangements that are nonetheless corrupt',
      'Violations where upstream data entry was manipulated to appear compliant',
    ],
  },
];

const INVISIBLE_FRAUD = [
  { icon: 'Ghost', label: 'Ghost works', detail: 'Sanctioned on paper, never executed. No GPS or photo verification in the dataset.' },
  { icon: 'Handshake', label: 'Bid rigging / collusion', detail: 'No tender data available in MPLADS public portal.' },
  { icon: 'Money', label: 'Correctly-priced kickbacks', detail: 'If the bribe is built into the market rate, the cost appears normal.' },
  { icon: 'Build', label: 'Quality substitution', detail: 'Full budget spent, inferior materials used. Not detectable from payment data alone.' },
  { icon: 'Person', label: 'Beneficiary diversion', detail: 'Work executed for wrong beneficiary. No beneficiary records in the dataset.' },
  { icon: 'Company', label: 'Related-party vendors', detail: 'No ownership/directorship data to identify shell companies.' },
];

export const MethodologyPage: React.FC = () => {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Page header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 border border-blue-200 rounded-xl">
              <BookOpen className="w-5 h-5 text-blue-600" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Methodology & Limitations
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            How DrishtiX works, what it can find, and crucially what it cannot.
          </p>
        </div>

        {/* Opening statement */}
        <div className="p-6 bg-blue-600 rounded-2xl text-white">
          <p className="text-lg font-bold leading-relaxed">
            "DrishtiX ranks works so a human auditor knows where to look first.
            It does not decide who is guilty."
          </p>
          <p className="text-sm text-blue-200 mt-2">
            Every score is a triage priority, not a verdict. Unusual is not fraudulent.
          </p>
        </div>

        {/* What the system does */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-3">What this system does</h2>
          <div className="text-sm text-slate-700 space-y-2 leading-relaxed">
            <p>
              MPLADS allows each Member of Parliament to recommend up to Rs 5 crore/year of local
              development works. With lakhs of works and thousands of implementing agencies, manual
              oversight of every project is impossible. DrishtiX applies four unsupervised
              detectors to the full dataset and produces a 0-100 composite risk score for every work.
            </p>
            <p>
              Works scoring above 70 are marked <strong>High Priority (Red)</strong>.
              Works scoring 40-70 are <strong>Amber (Needs Review)</strong>.
              Below 40 is <strong>Green (Low Risk)</strong>. Grey works have{' '}
              <strong>insufficient data</strong> to score — a distinct state, not a clean bill of health.
            </p>
            <p className="font-semibold text-slate-800">
              The system was never shown a single confirmed fraud case. It cannot find fraud —
              it can only find unusual, and it says so.
            </p>
          </div>
        </div>

        {/* Worked example */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-1">Scoring worked example</h2>
          <p className="text-xs text-slate-400 mb-4">
            A real-data road project that scored 84.3 (Red)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] font-semibold">
                  <th className="px-4 py-3 text-left border border-slate-200">Detector</th>
                  <th className="px-4 py-3 text-right border border-slate-200">Severity (0-1)</th>
                  <th className="px-4 py-3 text-right border border-slate-200">x Weight</th>
                  <th className="px-4 py-3 text-right border border-slate-200">= Points</th>
                  <th className="px-4 py-3 text-left border border-slate-200">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { det: 'Cost Outlier', sev: '1.000', wt: '40%', pts: '30.00', why: 'Rs 50,00,000 vs Rs 5,00,000 median (cost_z = 12.14)' },
                  { det: 'Duplicate / Template', sev: '0.727', wt: '30%', pts: '21.81', why: 'One vendor paid Rs 46,600 twenty-six times' },
                  { det: 'Delay / Aging', sev: '1.000', wt: '30%', pts: '30.00', why: 'Open 957 days; similar roads finish in 149' },
                  { det: 'Statutory Rules', sev: '0.500', wt: 'override', pts: '—', why: '>3 vendors; forced minimum Amber' },
                ].map((row) => (
                  <tr key={row.det} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-semibold text-slate-800 border border-slate-100">{row.det}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700 border border-slate-100">{row.sev}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-500 border border-slate-100">{row.wt}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900 border border-slate-100">{row.pts}</td>
                    <td className="px-4 py-2.5 text-slate-500 border border-slate-100">{row.why}</td>
                  </tr>
                ))}
                <tr className="bg-slate-900 text-white">
                  <td className="px-4 py-2.5 font-black border border-slate-700">Total</td>
                  <td className="px-4 py-2.5 border border-slate-700" />
                  <td className="px-4 py-2.5 border border-slate-700" />
                  <td className="px-4 py-2.5 text-right font-black font-mono text-rose-400 border border-slate-700">84.31</td>
                  <td className="px-4 py-2.5 text-rose-400 font-bold border border-slate-700">Red — High Priority</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Detector cards */}
        <div>
          <h2 className="text-base font-bold text-slate-900 mb-4">The four detectors</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DETECTOR_CARDS.map((d) => {
              const Icon = d.Icon;
              const isOpen = expanded === d.id;
              return (
                <div key={d.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <button
                    type="button"
                    className="w-full p-5 text-left flex items-start gap-4 hover:bg-slate-50 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : d.id)}
                  >
                    <div className={`p-2.5 rounded-xl border shrink-0 ${d.iconBg}`}>
                      <Icon className={`w-5 h-5 ${d.iconColor}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900">{d.title}</span>
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-full text-slate-600 shrink-0">
                          {d.weight}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{d.what}</p>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 space-y-3 border-t border-slate-100 pt-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Baseline method</span>
                        <p className="text-xs text-slate-600 mt-1">{d.baseline}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Cannot catch</span>
                        <ul className="mt-1 space-y-1">
                          {d.cannotCatch.map((item, i) => (
                            <li key={i} className="text-xs text-slate-500 flex items-start gap-1.5">
                              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Structurally invisible fraud */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-1">Structurally invisible fraud types</h2>
          <p className="text-xs text-slate-400 mb-4">
            No MPLADS anomaly detection system can detect these without additional data sources not present in the public portal.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {INVISIBLE_FRAUD.map((item) => (
              <div key={item.label} className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-xs font-bold text-slate-800 mb-0.5">{item.label}</div>
                <p className="text-[11px] text-slate-500">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Accuracy & validation */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-3">Accuracy & validation</h2>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 mb-4">
            <p className="font-bold">There is no fraud label anywhere in public MPLADS data.</p>
            <p className="mt-1">
              An accuracy figure (precision, recall, F1) would require knowing which works are actually
              fraudulent. No such label exists in any public source — so any quoted accuracy figure
              would be fabricated. We do not quote one.
            </p>
          </div>
          <div className="text-sm text-slate-700 space-y-2">
            <p>
              What we can defend: the system reduces a full-dataset pile to a high-priority
              review queue — a <strong>98.5% reduction</strong> — and{' '}
              <strong>42.7% of those flags rest on hard, checkable arithmetic</strong> (payment
              patterns, rule violations) rather than a statistical comparison.
            </p>
          </div>
        </div>

        {/* Known data gaps */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-3">Known data gaps</h2>
          <div className="space-y-2">
            {[
              { pct: '55.0%', field: 'completion_date (actual_completion)', impact: 'Delay scoring falls back to open-since-sanction-date; works without a recorded completion date cannot be verified as complete.' },
              { pct: '27.3%', field: 'expenditure records', impact: 'Fund-utilisation cannot be computed; payment-pattern analysis is unavailable.' },
              { pct: '~28%', field: 'Rajya Sabha member coverage', impact: 'Some RS members works are not captured in the ingested term folders.' },
              { pct: 'N/A', field: 'No year-on-year trend', impact: 'Current build covers 18th Lok Sabha (Jun 2023 to Aug 2026) only. Cross-term MP or state comparisons are not yet possible.' },
            ].map((row) => (
              <div key={row.field} className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <span className="font-black text-rose-600 font-mono w-14 shrink-0">{row.pct}</span>
                <div>
                  <span className="font-bold text-slate-800">{row.field}</span>
                  <p className="text-slate-500 mt-0.5">{row.impact}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Attribution fairness */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-3">Attribution fairness</h2>
          <p className="text-sm text-slate-700">
            An MP <strong>recommends</strong> a work. The Implementing District Authority{' '}
            <strong>executes</strong> it and manages payments. Delay, vendor behaviour, and
            payment patterns reflect the implementing agency's conduct, not necessarily the
            recommending MP's. DrishtiX displays both the MP and the implementing agency
            on every flagged work card.
          </p>
          <p className="text-xs text-slate-500 mt-2">
            A high risk score on a work does not imply misconduct by the MP who recommended it.
            It means the work's execution profile is unusual relative to comparable works.
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 pb-4">
          SIH 26102 · DrishtiX · Team Dead Neurons · MoSPI MPLADS Anomaly Detection
        </div>

      </main>
    </div>
  );
};
