export function SiteFooter() {
  return (
    <footer className="flex flex-wrap justify-between gap-x-5 gap-y-1 border-t border-ink px-5 py-3 text-[11px]">
      <span>xmanufacture</span>
      <span>About · For mills · For agents · Terms</span>
      <span>© {new Date().getFullYear()}</span>
    </footer>
  );
}
