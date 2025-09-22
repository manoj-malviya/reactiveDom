const reactiveDom = (() => {
  let data = {};

  const get = (obj, path) =>
    path.split('.').reduce((acc, key) => acc?.[key], obj) ?? '';

  const handleThis = (el, key) => (data[key] = el);

  const handleGroup = (el, signal) => {
    if (!signal) return;

    if (el.type === "checkbox") {
      const updateCheckbox = () =>
        (el.checked = new Set(signal.value).has(el.value));

      updateCheckbox();
      watch(signal, updateCheckbox);

      el.addEventListener("change", () => {
        const set = new Set(signal.value);
        el.checked ? set.add(el.value) : set.delete(el.value);
        signal.value = [...set];
      });
    }

    if (el.type === "radio") {
      const updateRadio = () => (el.checked = el.value === signal.value);

      updateRadio();
      watch(signal, updateRadio);

      el.addEventListener("change", () => {
        if (el.checked) signal.value = el.value;
      });
    }
  };

  const handleBinding = (el, prop, signal) => {
    const isInput = el.tagName.toLowerCase() === "input";

    const update = () => {
      el[prop] = signal.value;
    };

    update();
    watch(signal, update);

    if (isInput && prop === "value") {
      el.addEventListener("input", e => (signal.value = e.target.value));
    }
  };

  const handleClass = (el, className, signal) => {
    const update = () =>
      el.classList.toggle(className, !!signal.value);

    update();
    watch(signal, update);
  };

  const handleIf = (el, signal) => {
    const update = () => (el.style.display = signal.value ? "" : "none");

    update();
    watch(signal, update);
  };

  const processForeachNode = (node, item, index, signal) => {
    const interpolate = str =>
      str
        .replace(/\${index}/g, index)
        .replace(/\${item\.([\w.]+)}/g, (_, key) => get(item, key))
        .replace(/\${item}/g, item);

    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent = interpolate(node.textContent);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      [...node.attributes].forEach(attr => {
        if (attr.name.startsWith("on")) {
          const handler = data[attr.value];
          if (typeof handler === "function") {
            node.addEventListener(attr.name.slice(2).toLowerCase(), e =>
              handler(e, index, item, signal)
            );
          }
        } else {
          attr.value = interpolate(attr.value);
        }
      });

      [...node.childNodes].forEach(child =>
        processForeachNode(child, item, index, signal)
      );
    }
  };

  const handleForeach = (el, signal) => {
    if (!signal) return;

    const parent = el.parentNode;
    const template = el.cloneNode(true);
    el.remove();

    const update = () => {
      parent.querySelectorAll(`[data-foreach="${signal}"]`).forEach(n => n.remove());

      signal.value.forEach((item, i) => {
        const clone = template.cloneNode(true);
        clone.setAttribute("data-foreach", signal);
        processForeachNode(clone, item, i, signal);
        parent.appendChild(clone);
        reactiveDom(false, clone);
      });
    };

    update();
    watch(signal, (oldVal, newVal) => {
      if (oldVal !== newVal || oldVal.length !== newVal.length) update();
    }, true);
  };

  function reactiveDom(explicit = false, scope = null, newData = {}) {
    data = { ...data, ...newData };
    const elements = scope
      ? scope.querySelectorAll("*")
      : explicit
        ? document.querySelectorAll("[reactiveDom]")
        : document.querySelectorAll("*");

    elements.forEach(el => {
      if (explicit && !el.hasAttribute("reactiveDom")) return;

      [...el.attributes].forEach(({ name, value }) => {
        if (name === "this") handleThis(el, value);
        else if (name === "bind:group") handleGroup(el, data[value]);
        else if (name.startsWith("bind:")) {
          const prop =
            name === "bind:html"
              ? "innerHTML"
              : name === "bind:text"
                ? "innerText"
                : name.slice(5);
          handleBinding(el, prop, data[value]);
        } else if (name.startsWith("class:")) {
          handleClass(el, name.slice(6), data[value]);
        } else if (name === "if") {
          handleIf(el, data[value]);
        } else if (name === "foreach") {
          handleForeach(el, data[value]);
        }
      });
    });
  }

  return reactiveDom;
})();