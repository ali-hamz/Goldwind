import { useState } from 'react';
import { useWeather } from '../WeatherContext';
import { Panel } from '../components/ui';
import { createReport, deleteReport, loadReports, reportMatchesSite, updateReport, type ReportRecord } from '../lib/reports';
import { downloadReportPdf } from '../lib/pdf';
import { fmtDateTime } from '../lib/openMeteo';
import { Check, Download, FilePlus2, FileText, Info, Trash2, X } from 'lucide-react';

const STATUS_LABEL = { pending_review: 'PENDING HSE MANAGER REVIEW', approved: 'APPROVED', rejected: 'REJECTED' } as const;

export default function Reports() {
  const { data, settings, reports, setReports, refresh } = useWeather();
  const siteReports = reports.filter((r) => reportMatchesSite(r, settings));
  const [busy, setBusy] = useState<string | null>(null);
  const [reviewer, setReviewer] = useState('');
  const tz = settings.timezone;

  const generate = async () => {
    setBusy('new');
    const w = (await refresh()) ?? data;
    if (w) {
      const rec = createReport(w, settings, 'manual');
      setReports(loadReports());
      await downloadReportPdf(rec);
    }
    setBusy(null);
  };

  const download = async (r: ReportRecord) => {
    setBusy(r.id);
    try {
      await downloadReportPdf(r);
    } finally {
      setBusy(null);
    }
  };

  const review = (r: ReportRecord, status: 'approved' | 'rejected') => {
    if (!reviewer.trim()) {
      alert('Enter the reviewer name first.');
      return;
    }
    const comment = status === 'rejected' ? prompt('Reason for rejection (optional):') ?? '' : undefined;
    setReports(updateReport(r.id, { status, reviewer: reviewer.trim(), reviewedAt: Date.now(), comment }));
  };

  return (
    <div className="grid">
      <Panel title="Daily weather forecast & monitoring report" subtitle="Branded PDF · 2–3 pages · HSE Manager approval" icon={FileText} className="span-12">
        <div className="row-gap wrap">
          <button className="btn btn-primary" onClick={() => void generate()} disabled={!data || busy === 'new'}>
            <FilePlus2 size={16} /> {busy === 'new' ? 'Generating…' : 'Generate & download PDF now'}
          </button>
          <label className="field inline">
            <span>Reviewer name (HSE Manager)</span>
            <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="e.g. HSE Manager name" />
          </label>
        </div>
        <div className="info-box">
          <Info size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
          <b>Daily schedule (site time, {tz}):</b> {settings.schedule.fetchTime} retrieve weather · {settings.schedule.prepareTime} update dashboard &amp; prepare report ·{' '}
          {settings.schedule.reportTime} generate daily report → status <i>Pending HSE Manager review</i>.
          <br />
          This is a static web application without a server: scheduled steps run in any browser that has the dashboard open (e.g. a control-room screen). If no browser is
          open at {settings.schedule.reportTime}, the report is generated automatically the next time the dashboard is opened that day. Reports are stored in this browser.
          <br />
          Reports are <b>never emailed automatically</b>. Distribute to the client only after HSE Manager approval.
        </div>
      </Panel>
      <Panel title={`Report register (${siteReports.length})`} icon={FileText} className="span-12">
        {siteReports.length === 0 ? (
          <p className="dim">No reports yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th className="l">Report date</th>
                  <th className="l">Generated</th>
                  <th className="l">Trigger</th>
                  <th className="l">Status</th>
                  <th className="l">Reviewer</th>
                  <th className="l">Actions</th>
                </tr>
              </thead>
              <tbody>
                {siteReports.map((r) => (
                  <tr key={r.id}>
                    <td className="l mono">{r.date}</td>
                    <td className="l mono">{fmtDateTime(Math.floor(r.createdAt / 1000), tz)}</td>
                    <td className="l">{r.trigger === 'scheduled' ? 'Scheduled' : 'Manual'}</td>
                    <td className="l">
                      <span className={`status-pill sp-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                      {r.comment && <div className="small dim">{r.comment}</div>}
                    </td>
                    <td className="l">
                      {r.reviewer ? (
                        <>
                          {r.reviewer}
                          <div className="small dim">{r.reviewedAt ? fmtDateTime(Math.floor(r.reviewedAt / 1000), tz) : ''}</div>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="l">
                      <div className="row-gap wrap">
                        <button className="btn btn-sm" onClick={() => void download(r)} disabled={busy === r.id}>
                          <Download size={13} /> {busy === r.id ? '…' : 'Download PDF'}
                        </button>
                        {r.status === 'pending_review' && (
                          <>
                            <button className="btn btn-sm btn-success" onClick={() => review(r, 'approved')}>
                              <Check size={13} /> Approve
                            </button>
                            <button className="btn btn-sm btn-ghost" onClick={() => review(r, 'rejected')}>
                              <X size={13} /> Reject
                            </button>
                          </>
                        )}
                        <button
                          className="btn btn-sm btn-ghost btn-danger"
                          aria-label="Delete"
                          onClick={() => {
                            if (confirm(`Delete report ${r.date}?`)) setReports(deleteReport(r.id));
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="small dim">
          Approval here is a record kept in this browser, not an authenticated electronic signature. For formal sign-off, print the approved PDF and sign the Reviewed By box.
        </p>
      </Panel>
    </div>
  );
}
