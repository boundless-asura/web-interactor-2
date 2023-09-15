const superAGIPort = chrome.runtime.connect({name: "super_agi"});

function setNativeValue(element, value) {
  console.log("element here:",element)
  console.log(Object,Object.getOwnPropertyDescriptor(element,'value'))
  const valueSetter = Object.getOwnPropertyDescriptor(element, 'value').set;
  const prototype = Object.getPrototypeOf(element);
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;

  if (valueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value);
  } else {
    valueSetter.call(element, value);
  }
}
window.addEventListener('load' ,async() => {
    console.log("new page loaded",window.location.href)
    // await clearState()
    
    // window.localStorage.clear(); 
    // if(window.location.href.includes("localhost:3000")){
    //   window.location.href='http://localhost:3000/'
    // }
  //   console.log("started localhost")
  //   chrome.storage.local.get(null, function(items) {
  //     for (key in items) {
  //         if(key=="state" && window.location.href.includes("localhost")){
  //           console.log("key",key)
  //           chrome.storage.local.clear();
  //         }
          
  //     }
  //  });
    let currentState = null
    let currentPage = null
    let currentURL= null

    try {
        currentState = await getCurrentState()
        currentPage = currentState["new_page"] ? currentState["new_page"] : false
        // currentURL = currentState["page_url"]
        // // if(currentURL === window.location.href){
          
        // // }
        await clearState()
        currentState = null
        await setStateVariable("new_page", currentPage)
    }
    catch(err) {
        console.log("No state FOUND")
    }
    console.log("Window location", window.location.href, currentPage,currentURL)
    if(currentPage) {
      await wait(5000)
      const extractedDOM = extractDOM()

      await superAGIPort.postMessage({status:"PAGE_OPENED", page_url:window.location.href, last_action:"No action taken yet!", dom_content:extractedDOM })
    }
    else if (currentState == null || currentState["status"] == "POLLING")
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
    const currentState = await getCurrentState()
    const newPage = currentState["new_page"] ? currentState["new_page"] : false
    if(message["status"] == "RUNNING") {
        await setState({
            "status": message["status"],
            "agent_execution_id": message["agent_execution_id"],
            "new_page":newPage
        })
        const toLoop = handleAction(message)
        await setStateVariable("last_action", JSON.stringify(message))
        if (toLoop) {
            window.dispatchEvent(new CustomEvent("loop_interactor"))
        }
    } else if (message["status"] == "TRIGGER") {
        message["status"] = "RUNNING"
        message["new_page"] = newPage
        await setState(message)
        if(!newPage) {
          await setStateVariable("new_page", true)
          window.open('https://google.com', '_blank')
        }
    } else if(message["status"] == "COMPLETED") {
        let toLoop = handleAction(message)
        // await setStateVariable("last_action", JSON.stringify(message))
        // if (toLoop) {
        //     window.dispatchEvent(new CustomEvent("loop_interactor"))
        // }
        // handleAction(message)
        // await clearState()
        if(toLoop){
          await wait(5000)
          const extractedDOM = extractDOM()
          const pageUrl = window.location.href
          const agentExecutionId = message["agent_execution_id"]
          console.log("agent_ex",agentExecutionId,"curr_State",currentState)
          const lastAction = currentState["last_action"]
          await superAGIPort.postMessage({status:"RUNNING", dom_content:extractedDOM, page_url:pageUrl, agent_execution_id:agentExecutionId, last_action:lastAction})
          // toLoop=handleAction(message)
        }
        console.log("completed done")
    }else if(message["status"] == "AGENT_COMPLETED"){
        handleAction(message)
        console.log("AGENT COMPLETED SUCCESSFULLY")
        var queryInfo = {
          url: '*://localhost/*'
        };
        chrome.runtime.sendMessage({message: "refreshLocalhostTabs"});
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
  extractDOM()
  // console.log("****",extractDOM())
  console.log("ACTION TO TAKE",actionObj)
  // console.log("DOM RN",d)
    const {action,action_reference_element, action_reference_param} = actionObj
    if (action_reference_element && map[action_reference_element])
    {
      console.log(map[action_reference_element])
    }
    if (action == "GO_TO") {
      if (action_reference_param.includes("https://")) {
        // setStateVariable("page_url",action_reference_param)
        window.location.href = action_reference_param
      }
      else {
        // setStateVariable("page_url",`https://${action_reference_param}`)
        window.location.href = `https://${action_reference_param}`
      }

      return false
    }
    if (action == "CLICK")  {
      console.log("<><>for click",map[action_reference_element],action_reference_element)
      if(window.location.href.includes('compose=new')){
        map[action_reference_element].click()
        return true;
      }
      const mouseDownEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      map[action_reference_element].dispatchEvent(mouseDownEvent);
      
      // Simulate a mouse up event
      const mouseUpEvent = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      map[action_reference_element].dispatchEvent(mouseUpEvent);
      
      // Simulate a click event
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      map[action_reference_element].dispatchEvent(clickEvent);
      console.log("yup click",map[action_reference_element])
      if(map[action_reference_element].tagName=='input'){
        console.log("yes input",map[action_reference_element])
        map[action_reference_element].value=''
      }
     
    }
    if (action == "TYPE") {
      
      // console.log("on twitter")
      //try 1
      // console.log("reached map. action reference element->",action_reference_param,map[action_reference_element])
      // map[action_reference_element].focus();
      // if(document.execCommand('insertHTML', true, action_reference_param)){
      //   console.log("worked")
      // }else{
      //   console.log("didnt work")
      // }
      
      // map[action_reference_element].focus();
      // document.execCommand('insertText', false, action_reference_param);
      // map[action_reference_element].dispatchEvent(new Event('change', {bubbles: true}));
      
      //TRY 1
      var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      nativeInputValueSetter.call(map[action_reference_element], action_reference_param);
      var ev = new Event("input", {
        bubbles: true
      });
      map[action_reference_element].dispatchEvent(ev);
      // map[action_reference_element].innerText=action_reference_param

      //TRY 2
      const ss = new DataTransfer()
      ss.setData("text/plain", action_reference_param.slice(0,200))
      map[action_reference_element].dispatchEvent(new ClipboardEvent("paste", {
        clipboardData: ss,
        bubbles:true,
        cancelable:true
      }))
      ss.clearData()

      //TRY 3
      map[action_reference_element].value=action_reference_param

      const ke1 = new KeyboardEvent('keydown', {
        bubbles: true, cancelable: true, keyCode: 13
      });
      const ke2 = new KeyboardEvent('keyup', {
        bubbles: true, cancelable: true, keyCode: 13
      });
      
      // map[action_reference_element].focus()
      if(!window.location.href.includes('calendar') && !window.location.href.includes('slack')){
        map[action_reference_element].dispatchEvent(ke1);
        map[action_reference_element].dispatchEvent(ke2);
      }
      
    
      
      // const interactiveElements = ["navigation", "menu", "input", "button","textarea"]
      // if(interactiveElements.includes(map[action_reference_element].tagName)){
      //   
      
      //   map[action_reference_element].value=action_reference_param
      //   map[action_reference_element].focus()
      //   map[action_reference_element].dispatchEvent(ke);
      // }else {
      //   const ss = new DataTransfer()
      //   ss.setData("text/plain", action_reference_param)
      //   map[action_reference_element].dispatchEvent(new ClipboardEvent("paste", {
      //     clipboardData: ss,
      //     bubbles:true,
      //     cancelable:true
      //   }))
      //   ss.clearData()
      // }
      
    }
    // if (action == "TYPESUBMIT") {
    //   const ke = new KeyboardEvent('keydown', {
    //     bubbles: true, cancelable: true, keyCode: 13
    //   });
    //   map[action_reference_element].value=action_reference_param
    //   map[action_reference_element].focus()
    //   map[action_reference_element].dispatchEvent(ke);
    //   //todo
    // }
    return true
}
let map = {}
let counter = 0
const extractDOM_dep = () => {
    map = {}
    counter = 0
    const bodyHTML=document.body.innerHTML
    const elements = document.querySelectorAll("*")
    const result =""
    for (let i=0;i<elements.length;i++) {
      const element = elements[i]
      if(element.id) {
        let oldId = element.id
        element.id = i
        const element_string = element.outerHTML
        result += element_string + "\n"
        element.id = oldId  
      }else {
      element.id = i
      const element_string = element.outerHTML
      result += element_string + "\n"
      }
    }
    return result
    const e1 = Array.from(document.querySelectorAll('[role=textbox]'));
    const e2 = Array.from(document.querySelectorAll('[role=button]'));
    const e3 = Array.from(document.querySelectorAll('[role=navigation]'));
    const e4 = Array.from(document.querySelectorAll('[role=search]'));
    const elementsArray = [e1,e2,e3,e4]

    let transformedElements = '';
    let initial = true
    
    const setOfElements = new Set()
    const interactiveElements = ["navigation", "menu", "input", "button","textarea","textbox"]
    // const interactiveElements = ["navigation", "menu", "input", "button","textarea","textbox","span","p"]
    for (let i=0;i<interactiveElements.length;i++) {
      const elementType = interactiveElements[i]
      const elements = document.getElementsByTagName(elementType)
      for (let j=0;j<elements.length;j++)
      {
        setOfElements.add(elements[j])
      }
    }
    for (let i=0;i<elementsArray.length;i++) {
      for (let j=0;j<elementsArray[i].length;j++) {
        setOfElements.add(elementsArray[i][j]) 
      }
    }
    console.log(setOfElements)
    setOfElements.forEach((element) => {
      const role = element.getAttribute('role');

      if (initial) {
          transformedElements = transformElement(element)
          initial = false
      } else {
          transformedElements = `${transformedElements}${transformElement(element)}`
      }
        
    })
    return transformedElements
}

const transformElement = (element) =>{
    let elementString = `<${element.tagName.toLowerCase()}`
    elementString += ` id=${counter}`
    map[counter] = element
    counter++
    const elementAttributes = element.attributes
    for (let i=0;i<elementAttributes.length;i++) {
      const {name, value} = elementAttributes[i]  
      if(name.includes('label'))
      {
        elementString += ` label=${value}`
      }
      if(name.includes("role")){
        elementString += ` role=${value}`
      }
    }
    elementString += `>`
    elementString += element.textContent.slice(0,30)
    elementString += `</${element.tagName.toLowerCase()}>`

    return elementString
}

function generateStringFromDOM(node) {
  let result = '';
  let idCounter = 1;

  function preorderTraversal(node) {
    if (node !== null) {
      // Process the current node
      // console.log("node:",node)
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Assign an id attribute

        let idSet = false
        

        // Append the opening tag to the result
        result += '<' + node.tagName.toLowerCase();

        // Append attributes
        const attributes = node.attributes;
        for (let i = 0; i < attributes.length; i++) {
          const attr = attributes[i];
          if(attr.name == "id") {
            result += ` ${attr.name}="${idCounter}"`;
            map[idCounter] = node
            idCounter++
            idSet = true

          }else {
            result += ` ${attr.name}="${attr.value}"`;

          }
        }

        if (!idSet) {
          result += ` id="${idCounter}"`;
            map[idCounter] = node
            idCounter++
            idSet = true
        }

        result += '>';
      }
      if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.COMMENT_NODE) {
        result += node.textContent;
      }
      // Traverse child nodes
      const childNodes = node.childNodes;
      for (let i = 0; i < childNodes.length; i++) {
        const childNode = childNodes[i];
        preorderTraversal(childNode);
      }
      // console.log(node.tagName,"-")
      if(node.tagName=='IFRAME'){
        console.log("yes, iframe")
        if(!window.location.href.includes('google')){
          // var iframe_children=node.contentDocument.children[0].children
          if(node && node.contentDocument){
            preorderTraversal(node.contentDocument.body)
          }
          // for (let i = 0; i < iframe_children.length; i++) {
          //   const iframe_childNode = iframe_children[i];
          //   preorderTraversal(iframe_childNode);
          // }
        }
      }

      // Append the closing tag for element nodes
      if (node.nodeType === Node.ELEMENT_NODE) {
        result += `</${node.tagName.toLowerCase()}>`;
      }
    }
  }

  // Start the traversal from the root of the DOM tree

  preorderTraversal(node);
  // console.log("RESULT",result)
  return result;
}

// Example usage:
const extractDOM = () => {map = {};return generateStringFromDOM(document.body)};




// VV VVV VVV IMP DONT DELETE YET
// el.focus();
// document.execCommand('insertText', false, 'https://gokwik.co/');
// el.dispatchEvent(new Event('change', {bubbles: true}));