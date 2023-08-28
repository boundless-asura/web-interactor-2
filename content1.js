const superAGIPort = chrome.runtime.connect({name: "super_agi"});

window.addEventListener('load' ,async() => {
    let currentState = null

    try {
        currentState = await getCurrentState()
    }
    catch(err) {
        console.log("No state FOUND")
    }
    console.log("Window location", window.location.href, currentState)
    
    if (window.location.href == "http://localhost:3000/" && (currentState == null || currentState["status"] == "POLLING"))
    {
        const newState = await setStateVariable("status", "POLLING")
        console.log("NEW STATE", newState)
        superAGIPort.postMessage(newState);
    } else if(currentState && currentState["status"] == "RUNNING") {
      await wait(5000)
      const extractedDOM = extractDOM()
      const pageUrl = window.location.href
      const agentExecutionId = currentState["agent_execution_id"]
      const lastAction = currentState["last_action"]
      await superAGIPort.postMessage({status:"RUNNING", dom_content:extractedDOM, page_url:pageUrl, agent_execution_id:agentExecutionId, last_action:lastAction})
    } else {
        await clearState()
    }
})

superAGIPort.onMessage.addListener(async (message) => {
    if(message["status"] == "RUNNING") {
        await setState({
            "status": message["status"],
            "agent_execution_id": message["agent_execution_id"],
        })
        const toLoop = handleAction(message)
        await setStateVariable("last_action", JSON.stringify(message))
        if (toLoop) {
            window.dispatchEvent(new CustomEvent("loop_interactor"))
        }
    } else if (message["status"] == "TRIGGER") {
        message["status"] = "RUNNING"
        await setState(message)
        window.open('https://google.com', '_blank')
    } else if(message["status"] == "COMPLETED") {
        handleAction(message)
        await clearState()
    }
})


window.addEventListener("loop_interactor", async () => {
    const state = await getCurrentState()
    if (state["agent_execution_id"] && state["status"] === "RUNNING") {
        superAGIPort.postMessage(state)
    }
})



function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function getCurrentState() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(["state"], (result) => {
          if (!result["state"]) {
            reject("No state found")
            return
        };
          
          resolve(result["state"]);
        });
      });
}

function setStateVariable(key, value) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(["state"], (result) => {
            result[key] = value
            chrome.storage.local.set({state:result})
            resolve(result)
          });
    })
}

function setState(state) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({state:state})
        resolve(state)
    })
}
function clearState() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.clear(() => {
            const error = chrome.runtime.lastError
            if(error) {
                reject(error)
                return
            }
            resolve(true)
        })
    })
}



const handleAction = (actionObj) => {
    const {action,action_reference_element, action_reference_param} = actionObj
    if (action_reference_element && map[action_reference_element])
    {
      console.log(map[action_reference_element])
    }
    if (action == "GO_TO") {
      if (action_reference_param.includes("https://")) {
        window.location.href = action_reference_param
      }
      else {
        window.location.href = `https://${action_reference_param}`
      }
      return false
    }
    if (action == "CLICK")  {
      map[action_reference_element].focus()
      map[action_reference_element].click()
    }
    if (action == "TYPE") {
      const ss = new DataTransfer()
      ss.setData("text/plain", action_reference_param)
      map[action_reference_element].dispatchEvent(new ClipboardEvent("paste", {
        clipboardData: ss,
        bubbles:true,
        cancelable:true
      }))
      ss.clearData()
    }
    if (action == "TYPESUBMIT") {
      const ke = new KeyboardEvent('keydown', {
        bubbles: true, cancelable: true, keyCode: 13
      });
      map[action_reference_element].value=action_reference_param
      map[action_reference_element].focus()
      map[action_reference_element].dispatchEvent(ke);
      //todo
    }
    return true
}
let map = {}
let counter = 0
const extractDOM = () => {
    map = {}
    counter = 0
    const elementsWithRole = Array.from(document.querySelectorAll('[role]'));
    let transformedElements = '';
    let initial = true
    
    const setOfElements = new Set()
    const interactiveElements = ["navigation", "link", "menu", "input", "button","textarea","input"]
    for(let i=0;i < elementsWithRole.length ;i++) {
      setOfElements.add(elementsWithRole[i])
    }

    for (let i=0;i<interactiveElements.length;i++) {
      const elementType = interactiveElements[i]
      const elements = document.getElementsByTagName(elementType)
      for (let j=0;j<elements.length;j++)
      {
        setOfElements.add(elements[j])
      }
    }
    setOfElements.forEach((element) => {
      const role = element.getAttribute('role');

      if (initial) {
          transformedElements = transformElement(element)
          initial = false
      } else {
          transformedElements = `${transformedElements}
          
          ${transformElement(element)}`
      }
        
    })
    return transformedElements
}

const transformElement = (element) =>{
    if (element == null || element == undefined )
      return  ""
    const role = element.getAttribute('role') ? element.getAttribute('role').toLowerCase() : null ;
    const label = element.getAttribute('aria-label') ? element.getAttribute('aria-label').toLowerCase() : null;
    let transformedElementString = ""
    const innerText = element.textContent.trim();
    const describedById = element.getAttribute('aria-describedby')
    const labelledById = element.getAttribute('aria-labelledby')
    const controls = element.getAttribute('aria-controls')
    const dataId = element.getAttribute('data-test-id')
    const interactiveElements = ["navigation", "link", "menu", "input", "button","textarea","input"]
    if(label == "Compose new Message")
      return ""
    if(dataId && dataId == "SideNav_NewTweet_Button")
      return ""
    if (role) {
      transformedElementString = `<${interactiveElements.includes(element.tagName.toLowerCase())? element.tagName.toLowerCase() :  role === 'combobox' ? 'textbox' : role} id=${counter} ${label && label.length > 0 ? ` label="${label}"` : '' } ${dataId && dataId.length > 0 ? ` data-id="${dataId}"` : '' } >${innerText}</${interactiveElements.includes(element.tagName.toLowerCase())? element.tagName.toLowerCase() :  role === 'combobox' ? 'textbox' : role}>`
    } else {
      transformedElementString = `<${element.tagName.toLowerCase()} id=${counter} ${label && label.length > 0 ? ` label="${label}"` : '' } ${dataId && dataId.length > 0 ? ` data-id="${dataId}"` : '' } >${innerText}</${element.tagName.toLowerCase()}>`
    }
    map[counter] = element
    counter++;
    if (labelledById && labelledById.length > 0) {
        let labelledParentString = transformElement(document.getElementById(labelledById))
        return  `${labelledParentString}${transformedElementString}`
    }
    // if (describedById && describedById.length > 0) {
    //     let describedParentString = transformElement(document.getElementById(describedById))
    //     return `${describedParentString}${transformedElementString}`        
    // }
    return transformedElementString 
}