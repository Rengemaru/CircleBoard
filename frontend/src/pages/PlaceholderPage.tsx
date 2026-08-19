// T1-3 時点の仮ページ。ページ名を出すだけで、中身は後続タスクで作る。
type Props = {
  name: string;
};

export function PlaceholderPage({ name }: Props) {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">{name}</h1>
    </main>
  );
}
