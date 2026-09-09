import Wordmark from "@/components/brand/wordmark";

const Footer = () => (
  <footer className="mt-auto border-t border-line">
    <div className="mx-auto max-w-column px-s4 py-s6 text-center">
      <Wordmark as="div" className="text-[18px]" />
      <div className="mt-[14px] font-sans text-[11px] tracking-[0.18em] text-stone">
        Systems<span className="px-[0.5em] text-red">·</span>Cybersecurity
        <span className="px-[0.5em] text-red">·</span>Software
      </div>
      <p className="mt-s4 font-sans text-[11.5px] tracking-[0.06em] text-stone">
        <a
          href="https://github.com/luca-ramseyer/msg-viewer"
          className="border-b border-line transition-colors duration-200 hover:border-red hover:text-red"
        >
          Source on GitHub
        </a>
        <span className="px-[0.45em] text-red">·</span>
        <a
          href="https://raml.ch"
          className="border-b border-line transition-colors duration-200 hover:border-red hover:text-red"
        >
          raml.ch
        </a>
      </p>
    </div>
  </footer>
);

export default Footer;
