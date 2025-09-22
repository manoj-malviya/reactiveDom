const reactiveDom = (function() {
  // Shared data object
  let data = {};

  // Helper function to get nested object property value
  function getNestedValue(obj, path) {
    return path.split('.').reduce((current, prop) => {
      return current?.[prop] ?? '';
    }, obj);
  }

  // Handle 'this' attribute binding
  function handleThisBinding(element, attrValue) {
    data[attrValue] = element;
  }

  // Handle checkbox group binding
  function handleCheckboxGroupBinding(element, signalName) {
    const checkedValues = new Set(signalName.value);
    element.checked = checkedValues.has(element.value);

    watch(signalName, (oldValue, newValue) => {
      const checkedValues = new Set(newValue);
      element.checked = checkedValues.has(element.value);
    });

    element.addEventListener("change", () => {
      const checkedValues = new Set(signalName.value);
      if (element.checked) {
        checkedValues.add(element.value);
      } else {
        checkedValues.delete(element.value);
      }
      signalName.value = Array.from(checkedValues);
    });
  }

  // Handle radio group binding
  function handleRadioGroupBinding(element, signalName) {
    element.checked = element.value === signalName.value;

    watch(signalName, (oldValue, newValue) => {
      element.checked = element.value === newValue;
    });

    element.addEventListener("change", () => {
      if (element.checked) {
        signalName.value = element.value;
      }
    });
  }

  // Handle group binding (checkbox/radio)
  function handleGroupBinding(element, groupName) {
    const signalName = data[groupName];
    if (!signalName) return;

    if (element.type === "checkbox") {
      handleCheckboxGroupBinding(element, signalName);
    } else if (element.type === "radio") {
      handleRadioGroupBinding(element, signalName);
    }
  }

  // Handle property binding
  function handlePropertyBinding(element, property, signalName) {
    if (property === "value" && element.tagName.toLowerCase() === "input") {
      element.value = signalName.value;
    } else {
      element[property] = signalName.value;
    }

    element.addEventListener("input", function (event) {
      signalName.value = event.target.value;
    });

    watch(signalName, (oldValue, newValue) => {
      if (property === "value" && element.tagName.toLowerCase() === "input") {
        element.value = newValue;
      } else {
        element[property] = newValue;
      }
    });
  }

  // Handle class binding
  function handleClassBinding(element, className, signalName) {
    if (signalName.value) {
      element.classList.add(className);
    }

    watch(signalName, (oldValue, newValue) => {
      if (newValue) {
        element.classList.add(className);
      } else {
        element.classList.remove(className);
      }
    });
  }

  // Handle if condition
  function handleIfCondition(element, conditionSignalName) {
    element.style.display = conditionSignalName.value ? "" : "none";

    watch(conditionSignalName, (oldValue, newValue) => {
      element.style.display = newValue ? "" : "none";
    });
  }

  // Process foreach template node
  function processForeachNode(node, item, index, arraySignalName) {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent = node.textContent
        .replace(/\${index}/g, index)
        .replace(/\${item\.([^}]+)}/g, (match, prop) => {
          return getNestedValue(item, prop);
        })
        .replace(/\${item}/g, item);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      [...node.attributes].forEach(attr => {
        if (attr.name.startsWith('on')) {
          const eventName = attr.name.slice(2).toLowerCase();
          const handlerName = attr.value;
          const handler = data[handlerName];
          
          if (typeof handler === 'function') {
            node.addEventListener(eventName, (event) => {
              handler(event, index, item, arraySignalName);
            });
          }
        } else {
          attr.value = attr.value
            .replace(/\${index}/g, index)
            .replace(/\${item\.([^}]+)}/g, (match, prop) => {
              return getNestedValue(item, prop);
            })
            .replace(/\${item}/g, item);
        }
      });
      [...node.childNodes].forEach(childNode => processForeachNode(childNode, item, index, arraySignalName));
    }
  }

  // Handle foreach binding
  function handleForeachBinding(element, arraySignalName) {
    if (!arraySignalName) return;

    const parent = element.parentNode;
    const template = element.cloneNode(true);
    element.remove();

    function updateForeach() {
      const existingElements = parent.querySelectorAll(`[data-foreach="${arraySignalName}"]`);
      existingElements.forEach(el => el.remove());
      
      arraySignalName.value.forEach((item, index) => {
        const clone = template.cloneNode(true);
        clone.setAttribute('data-foreach', arraySignalName);
        processForeachNode(clone, item, index, arraySignalName);
        parent.appendChild(clone);
        reactiveDom(false, clone);
      });
    }
    
    updateForeach();
    
    watch(arraySignalName, (oldValue, newValue) => {
      if (oldValue !== newValue || oldValue.length !== newValue.length) {
        updateForeach();
      }
    }, true);
  }

  // Main reactiveDom function
  function reactiveDom(explicitReactive = false, targetElement = null, newData = {}) {
    // Update the shared data object
    data = { ...data, ...newData };
    
    const elements = targetElement 
      ? targetElement.querySelectorAll("*")
      : explicitReactive
        ? document.querySelectorAll("[reactiveDom]")
        : document.querySelectorAll("*");
    
    console.log(`Loading reactiveDom with ${elements.length} elements`);
    
    elements.forEach((element) => {
      if (explicitReactive && !element.hasAttribute("reactiveDom")) return;

      [...element.attributes].forEach((attr) => {
        const attrName = attr.name;
        const attrValue = attr.value;

        if (attrName === "this") {
          handleThisBinding(element, attrValue);
        } else if (attrName === "bind:group") {
          handleGroupBinding(element, attrValue);
        } else if (attrName.startsWith("bind:")) {
          let property = attrName.slice(5);
          if (property === "html") property = "innerHTML";
          else if (property === "text") property = "innerText";
          
          const signalName = data[attrValue];
          if (signalName) {
            handlePropertyBinding(element, property, signalName);
          }
        } else if (attrName.startsWith("class:")) {
          const className = attrName.slice(6);
          const signalName = data[attrValue];
          if (signalName) {
            handleClassBinding(element, className, signalName);
          }
        } else if (attrName === "if") {
          const conditionSignalName = data[attrValue];
          if (conditionSignalName) {
            handleIfCondition(element, conditionSignalName);
          }
        } else if (attrName === "foreach") {
          const arraySignalName = data[attrValue];
          if (arraySignalName) {
            handleForeachBinding(element, arraySignalName);
          }
        }
      });
    });
  }

  // Return only the public function
  return reactiveDom;
})();
