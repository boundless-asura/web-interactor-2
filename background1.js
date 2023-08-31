function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

chrome.storage.local.clear();
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "refreshLocalhostTabs") {
        console.log("messages sent to background1")
        chrome.tabs.query({url: '*://localhost/*'}, function(tabs) {
            tabs.forEach(function(tab){
                chrome.tabs.reload(tab.id);
            });
        });
    }
});
chrome.runtime.onConnect.addListener((port) => {
    console.assert(port.name === "super_agi");
    port.onMessage.addListener(async (message) => {
        if(message["status"] == "POLLING") {
            const agent_execution_id = await handlePolling()
           
            port.postMessage({"status":"TRIGGER", "agent_execution_id":agent_execution_id, "last_action":"No action taken yet"})
        }
        else if(message["status"] == "RUNNING" || message["status"] == "TRIGGER") {
            console.log("running message",message)
            const nextStep = await getNextStep(message["agent_execution_id"], message["page_url"], message["dom_content"], message["last_action"])
            if (nextStep) {
                port.postMessage(nextStep)
            }
        } else if(message["status"] == "PAGE_OPENED") {
            console.log("page_opened_1")
            const agent_execution_id = await handlePolling()
            console.log("page_opened_2")
            const nextStep = await getNextStep(agent_execution_id, message["page_url"], message["dom_content"], message["last_action"])
            console.log("page_opened_3")
            if (nextStep) {
                port.postMessage(nextStep)
            }
            console.log("page_opened_4")

        }
    })
})


async function getNextStep(agent_execution_id,page_url, dom_content, last_action) {
    const url = "http://localhost:3000/api/web_interactor/get_next_action"
    const message = {
        'dom_content': dom_content,
        'agent_execution_id': agent_execution_id,
        'last_action_status': true,
        'last_action':last_action,
        'page_url':page_url
    }
    // const formData = new FormData()
    // formData.append('dom_content', dom_content);
    // formData.append('agent_execution_id', agent_execution_id);
    // formData.append('last_action_status', true)
    // formData.append("last_action", last_action)
    // formData.append("page_url" , page_url)
    let data = null
    try {
        const res  = await fetch(url, {
            method:"POST",
            mode:"cors",
            body:JSON.stringify(message),
            headers: {'Content-Type': 'text/plain'}
        })
        data = await res.json()
        data["agent_execution_id"]=agent_execution_id
        console.log("NEXT ACTION",data)
    }
    catch (err) {
        console.error("CHECK tIS", err)
    }
    return data
}


async function handlePolling() {
    const url = "http://localhost:3000/api/web_interactor/execution"
    let agent_execution_id = null
    do {
        try {
            const res  = await fetch(url, {
                method:"GET",
                mode:"cors",
                headers: {'Content-Type': 'application/json'}
            })
            const data = await res.json()
            agent_execution_id = data["agent_execution_id"]
            if(agent_execution_id == null) {
                await wait(10000)
            }
        }
        catch (err) {
            console.error("CHECK tIS", err)
        }
    } while(agent_execution_id == null)
    console.log("POLLED",agent_execution_id)
    return agent_execution_id

}