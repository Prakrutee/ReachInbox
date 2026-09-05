import type { Email } from "../types";

interface Props {
  emails: Email[];
  loading: boolean;
  emptyMessage?: string;
}

const STATUS_CLASS: Record<string, string> = {
  scheduled: "badge-scheduled",
  processing: "badge-processing",
  sent: "badge-sent",
  failed: "badge-failed",
};

export default function EmailTable({ emails, loading, emptyMessage = "No emails found" }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <svg className="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <p className="font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left text-gray-400 font-medium py-3 px-4">Recipient</th>
            <th className="text-left text-gray-400 font-medium py-3 px-4">Subject</th>
            <th className="text-left text-gray-400 font-medium py-3 px-4">Scheduled</th>
            <th className="text-left text-gray-400 font-medium py-3 px-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {emails.map((email) => (
            <tr key={email.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
              <td className="py-3.5 px-4 text-gray-200 font-medium">{email.recipient}</td>
              <td className="py-3.5 px-4 text-gray-300 max-w-xs truncate">{email.subject}</td>
              <td className="py-3.5 px-4 text-gray-400 whitespace-nowrap">
                {new Date(email.scheduled_at).toLocaleString()}
              </td>
              <td className="py-3.5 px-4">
                <span className={STATUS_CLASS[email.status] || "badge-scheduled"}>
                  {email.status}
                </span>
                {email.error && (
                  <span className="ml-2 text-red-400 text-xs truncate max-w-xs" title={email.error}>
                    {email.error.slice(0, 40)}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
