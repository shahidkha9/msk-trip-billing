import type { Trip } from "@/lib/types";
import { fmtDate, num, sums, tripTotal } from "@/lib/utils";
import { Button } from "./ui";

interface Props {
  trips: Trip[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  showTotal?: boolean;
  print?: boolean;
}

/** The table of trips used on the entry page, records page and printed bill. */
export function TripTable({ trips, onEdit, onDelete, showTotal = false, print = false }: Props) {
  if (!trips.length) return <p className="p-4 text-[13px] text-muted">No entries found.</p>;
  const actions = !!(onEdit || onDelete);
  const s = sums(trips);
  const td = print ? "border border-gray-400 px-1.5 py-1" : "border-b border-line px-2.5 py-2";
  const th = `${td} bg-[#f7f9fc] font-semibold text-left`;
  const n = "text-right";

  return (
    <table className={`w-full border-collapse ${print ? "text-[10px]" : "text-[13.5px]"} [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap`}>
      <thead>
        <tr>
          <th className={th}>#</th>
          <th className={th}>Date</th>
          <th className={th}>Slip</th>
          <th className={th}>Vehicle</th>
          <th className={th}>Type</th>
          <th className={th}>From → To</th>
          <th className={th}>Route</th>
          <th className={th}>Qty</th>
          <th className={`${th} ${n}`}>Fare</th>
          <th className={`${th} ${n}`}>Load/Unload</th>
          <th className={`${th} ${n}`}>Detention</th>
          <th className={`${th} ${n}`}>Extra</th>
          <th className={`${th} ${n}`}>Total</th>
          {actions && <th className={th}></th>}
        </tr>
      </thead>
      <tbody>
        {trips.map((t, i) => (
          <tr key={t.id} className="hover:bg-[#fafcff]">
            <td className={td}>{i + 1}</td>
            <td className={td}>{fmtDate(t.date)}</td>
            <td className={td}>{t.slipNo}</td>
            <td className={td}>{t.vehicleNo}</td>
            <td className={td}>
              <span className="rounded-md bg-soft px-1.5 py-0.5 text-xs">{t.vehicleType}</span>
            </td>
            <td className={td}>
              {t.from} → {t.to}
            </td>
            <td className={td}>{t.route}</td>
            <td className={td}>{t.qty}</td>
            <td className={`${td} ${n}`}>{num(t.rent)}</td>
            <td className={`${td} ${n}`}>{t.loading ? num(t.loadAmt) : "-"}</td>
            <td className={`${td} ${n}`}>{t.detention ? num(t.detentionAmt) : "-"}</td>
            <td className={`${td} ${n}`}>{t.extra ? num(t.extra) : "-"}</td>
            <td className={`${td} ${n} font-bold`}>{num(tripTotal(t))}</td>
            {actions && (
              <td className={td}>
                <div className="flex gap-1.5">
                  {onEdit && (
                    <Button small variant="secondary" onClick={() => onEdit(t.id)}>
                      Edit
                    </Button>
                  )}
                  {onDelete && (
                    <Button small variant="danger" onClick={() => onDelete(t.id)}>
                      Del
                    </Button>
                  )}
                </div>
              </td>
            )}
          </tr>
        ))}
      </tbody>
      {showTotal && (
        <tfoot>
          <tr className="font-bold">
            <td className={`${td} ${n}`} colSpan={8}>
              Total
            </td>
            <td className={`${td} ${n}`}>{num(s.rent)}</td>
            <td className={`${td} ${n}`}>{num(s.load)}</td>
            <td className={`${td} ${n}`}>{num(s.detention)}</td>
            <td className={`${td} ${n}`}>{num(s.extra)}</td>
            <td className={`${td} ${n}`}>{num(s.total)}</td>
            {actions && <td className={td}></td>}
          </tr>
        </tfoot>
      )}
    </table>
  );
}
