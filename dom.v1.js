//
function nibbleDom(explicitNibble = false, targetElement = null) {
  
    const elements = targetElement 
      ? targetElement.querySelectorAll("*")
      : explicitNibble
        ? document.querySelectorAll("[nibble]")
        : document.querySelectorAll("*");
    console.log(`Loading NibbleDOM with ${elements.length} elements`);
    elements.forEach((element) => {
      if (explicitNibble && !element.hasAttribute("nibble")) return;
  
      
      [...element.attributes].forEach((attr) => {
        const attrName = attr.name;
        const attrValue = attr.value;
  
        if (attrName === "this") {
          
          window[attrValue] = element;
        } else if (attrName === "bind:group") {
          const groupName = attrValue;
          const signalName = window[groupName];
  
          if (element.type === "checkbox") {
            
            if (signalName) {
              
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
          } else if (element.type === "radio") {
            
            if (signalName) {
              
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
          }
        } else if (attrName.startsWith("bind:")) {
          let property = attrName.slice(5); 
          if (property === "html") {
            property = "innerHTML";
          } else if (property === "text") {
            property = "innerText";
          }
  
          const signalName = window[attrValue];
  
          if (signalName) {
            
            if (
              property === "value" &&
              element.tagName.toLowerCase() === "input"
            ) {
              element.value = signalName.value;
            } else {
              element[property] = signalName.value;
            }
  
            element.addEventListener("input", function (event) {
              signalName.value = event.target.value;
            });
            watch(signalName, (oldValue, newValue) => {
              if (
                property === "value" &&
                element.tagName.toLowerCase() === "input"
              ) {
                element.value = newValue;
              } else {
                element[property] = newValue;
              }
            });
          }
        } else if (attrName.startsWith("class:")) {
          const className = attrName.slice(6); 
          const signalName = window[attrValue];
  
          if (signalName) {
            
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
        } else if (attrName === "if") {
          const conditionSignalName = window[attrValue];
          
          element.style.display = conditionSignalName.value ? "" : "none";
  
          watch(conditionSignalName, (oldValue, newValue) => {
            element.style.display = newValue ? "" : "none";
          });
        } else if (attrName === "foreach") {
          const arraySignalName = window[attrValue];
          
          if (arraySignalName) {
            const parent = element.parentNode;
            const template = element.cloneNode(true);
            element.remove(); // Remove the template element
            
            function updateForeach() {
              // Remove all existing foreach elements
              const existingElements = parent.querySelectorAll(`[data-foreach="${arraySignalName}"]`);
              existingElements.forEach(el => el.remove());
              
              // Create new elements for each array item
              arraySignalName.value.forEach((item, index) => {
                const clone = template.cloneNode(true);
                clone.setAttribute('data-foreach', arraySignalName);
                
                // Replace ${index} and ${item} in attributes and content
                const processNode = (node) => {
                  if (node.nodeType === Node.TEXT_NODE) {
                    node.textContent = node.textContent
                      .replace(/\${index}/g, index)
                      .replace(/\${item}/g, item);
                  } else if (node.nodeType === Node.ELEMENT_NODE) {
                    [...node.attributes].forEach(attr => {
                      attr.value = attr.value
                        .replace(/\${index}/g, index)
                        .replace(/\${item}/g, item);
                    });
                    [...node.childNodes].forEach(processNode);
                  }
                };
                processNode(clone);
                
                parent.appendChild(clone);
                // Apply NibbleDOM only to the new element
                nibbleDom(false, clone);
              });
            }
            
            // Initial render
            updateForeach();
            
            // Watch for changes with deep comparison
            watch(arraySignalName, (oldValue, newValue) => {
              // Only update if the array reference or length has changed
              if (oldValue !== newValue || oldValue.length !== newValue.length) {
                updateForeach();
              }
            }, true); // Enable deep watching
          }
        }
      });
    });
  }
