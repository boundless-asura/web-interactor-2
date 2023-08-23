console.log("My script injecte132")
const loadSavedData = (key) => {

  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (result) => {
      if (!result[key]) return;
      console.log(result);
      resolve(result[key]);
    });
  });
  
};

var port = chrome.runtime.connect({name: "knockknock"});

port.onMessage.addListener( async function(msg) {
  console.log("Message Received from Service", msg)
  const toLoop = handleAction(msg)
  await chrome.storage.local.set({'last_action': JSON.stringify(msg)});
  if( msg["status"] == "COMPLETED") {
    chrome.storage.sync.clear()
  }
  else {
    if (toLoop){
      loop(JSON.stringify(msg))
    }
  }
});
const loop = (last_action) => {
  const data = loadSavedData("agent_execution_id");
    let agent_execution_id=null
    let extractedDOM=extractDOM()
    console.log("PRINTING DOM IN LOOP",last_action , extractedDOM)
    data.then((res) => {
      // console.log("res",res);
      if(res){
          port.postMessage({ agent_execution_id:res, page_url:window.location.href, dom_content:extractedDOM,last_action:last_action });
      }
      
    })
}

window.addEventListener('load',()=>{
    console.log(window.location)
    const data = loadSavedData("agent_execution_id");
    
    let agent_execution_id=null
    let extractedDOM=
    data.then((res) => {
      // console.log("res",res);
      if(res){
        console.log("Reached 4")
        console.log(res)
        setTimeout(()=>{
          extractedDOM =  extractDOM()
          const last_action = loadSavedData('last_action')
          last_action.then(ress => {
            port.postMessage({ agent_execution_id:res, dom_content:extractedDOM, last_action:ress,page_url:window.location.href });
          })
          // console.log(extractedDOM)
          
        },2000) 
      }
    })
    
  window.addEventListener("superagi_web_trigger",async (e) => {
    console.log("EENT FRI SYOER AGI", e)
    const agent_execution_id2 = e.detail.agent_execution_id
    await chrome.storage.local.set({'agent_execution_id': agent_execution_id2});
    await chrome.storage.local.set({'state': "TRIGGER"});
    await chrome.storage.local.set({'last_action': "No action taken yet"})
    // localStorage.setItem("agent_execution_id", agent_execution_id)
    // localStorage.setItem("state", "TRIGGER")
    console.log("Memory SET", agent_execution_id2)
    // extractedDOM=extractDOM()
    //       // console.log(extractedDOM)
    //       port.postMessage({ agent_execution_id:res, dom_content:extractedDOM,last_action:"No action taken yet" });
    window.open('https://google.com', '_blank')
})})

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
  return true
}