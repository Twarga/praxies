const revealItems = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16 },
  );

  revealItems.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index * 45, 240)}ms`;
    observer.observe(item);
  });
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

const terminal = document.querySelector("[data-terminal]");

if (terminal && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const text = terminal.textContent || "";
  terminal.textContent = "";
  let index = 0;

  const write = () => {
    terminal.textContent = text.slice(0, index);
    index += 1;

    if (index <= text.length) {
      window.setTimeout(write, index % 18 === 0 ? 110 : 16);
    }
  };

  window.setTimeout(write, 520);
}
