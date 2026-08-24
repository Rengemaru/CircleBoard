import { Link } from "react-router-dom";

// wireframe-admin-ver2.html の .section-heading に対応する。
//
// link を渡すと右端に「すべて見る →」が出る。トップページのように
// 一覧の一部だけを見せている場所で、続きの在り処を示すために使う。
export function SectionHeading({
  children,
  link,
  linkLabel = "すべて見る →",
}: {
  children: React.ReactNode;
  link?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between border-b-2 border-gray-200 pb-1.5">
      <h2 className="text-[13px] font-bold text-gray-700">{children}</h2>
      {link !== undefined && (
        <Link to={link} className="text-xs text-gray-500 hover:text-gray-900">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
