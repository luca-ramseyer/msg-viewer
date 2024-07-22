const Footer = () => {
  return (
    <footer className="fixed bottom-0 w-full flex flex-col items-center justify-center text-sm text-foreground">
      <div className="bg-card p-2 rounded-t-lg shadow-lg shadow-primary flex flex-row gap-2">
        <p className="text-xs">Made with ❤️ by <a href="https://github.com/luca-ramseyer" className="text-primary">Luca Ramseyer</a></p>
        <p className="text-xs">-</p>
        <p className="text-xs">View the source code on <a href="https://github.com/luca-ramseyer/msg-viewer" className="text-primary">GitHub</a></p>
      </div>
    </footer>
  );
}

export default Footer;