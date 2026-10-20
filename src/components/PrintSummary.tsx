// Print-only design summary (hidden on screen). Use the browser's
// "Save as PDF" in the print dialog for a PDF copy.
import { WardrobeSVG } from "../engine/WardrobeSVG";
import { customDoorLines, designSummaryLines } from "../engine/export";
import { formatMoney, type Quote } from "../engine/quote";
import type { Design } from "../state/types";

export function PrintSummary({ design, quote, currency }: { design: Design; quote: Quote; currency: string }) {
  const doors = customDoorLines(design);
  return (
    <div className="print-only" aria-hidden="true">
      <header className="print-head">
        <div>
          <h1>{design.name}</h1>
          <p>Wardrobe Studio – design summary · {new Date().toLocaleDateString()}</p>
        </div>
      </header>
      <div className="print-grid">
        <div className="print-preview">
          <WardrobeSVG design={design} showDims />
        </div>
        <div>
          <h2>Configuration</h2>
          <table>
            <tbody>
              {designSummaryLines(design).map(([k, v]) => (
                <tr key={k}>
                  <th>{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {doors.length > 0 && (
            <>
              <h2>Individually customised shutters</h2>
              <ul>
                {doors.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
      <h2>Indicative estimate</h2>
      <table className="print-quote">
        <tbody>
          {quote.lines.map((l) => (
            <tr key={l.label}>
              <th>
                {l.label} <small>{l.detail}</small>
              </th>
              <td>{formatMoney(l.amount, currency)}</td>
            </tr>
          ))}
          <tr>
            <th>Subtotal</th>
            <td>{formatMoney(quote.subtotal, currency)}</td>
          </tr>
          {quote.discount > 0 && (
            <tr>
              <th>Discount</th>
              <td>−{formatMoney(quote.discount, currency)}</td>
            </tr>
          )}
          <tr>
            <th>GST</th>
            <td>{formatMoney(quote.gst, currency)}</td>
          </tr>
          <tr className="total">
            <th>Indicative total</th>
            <td>{formatMoney(quote.total, currency)}</td>
          </tr>
        </tbody>
      </table>
      <p className="print-note">
        The preview is a proportional visual estimate, not an engineering-accurate manufacturing drawing. The quotation is indicative, based on editable sample rates and visual surface areas;
        measurements, material quantities and prices must be verified before manufacturing.
      </p>
    </div>
  );
}
