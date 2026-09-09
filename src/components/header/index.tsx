import Mark from "@/components/brand/mark";
import Wordmark from "@/components/brand/wordmark";

const Header = () => (
  <header className="border-b border-line">
    <div className="mx-auto flex max-w-column items-center justify-between gap-s3 px-s4 py-s3">
      <a
        href="https://raml.ch"
        className="flex items-center gap-s2 transition-colors duration-200"
      >
        <Mark size={22} />
        <Wordmark className="text-[13px] sm:text-[15px]" />
      </a>
      <a
        href="https://github.com/luca-ramseyer/msg-viewer"
        className="eyebrow tracking-label transition-colors duration-200 hover:text-red"
      >
        Source
      </a>
    </div>
  </header>
);

export default Header;
