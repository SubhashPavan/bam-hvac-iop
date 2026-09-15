import { LayoutGrid, MessageSquare } from 'lucide-react';

export default function EmptyCanvas() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-50 to-accent-100 text-accent-600 ring-1 ring-inset ring-accent-200">
        <LayoutGrid className="h-7 w-7" />
      </div>
      <h3 className="text-[18px] font-bold tracking-tight text-navy-900">Your canvas</h3>
      <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-navy-500">
        Ask questions in the chat to populate your canvas with interactive charts, tables, and
        narrative insights.
      </p>
      <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-navy-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-navy-700 shadow-sm">
        <MessageSquare className="h-3.5 w-3.5 text-accent-500" />
        Start by asking a question
      </div>
    </div>
  );
}
