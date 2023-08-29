function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

chrome.runtime.onConnect.addListener((port) => {
    console.assert(port.name === "super_agi");
    port.onMessage.addListener(async (message) => {
        if(message["status"] == "POLLING") {
            const agent_execution_id = await handlePolling()
            port.postMessage({"status":"TRIGGER", "agent_execution_id":agent_execution_id, "last_action":"No action taken yet"})
        }
        else if(message["status"] == "RUNNING" || message["status"] == "TRIGGER") {
            const nextStep = await getNextStep(message["agent_execution_id"], message["page_url"], message["dom_content"], message["last_action"])
            if (nextStep) {
                port.postMessage(nextStep)
            }
        } else if(message["status"] == "PAGE_OPENED") {
            const agent_execution_id = await handlePolling()
            const nextStep = await getNextStep(agent_execution_id, message["page_url"], message["dom_content"], message["last_action"])
            if (nextStep) {
                port.postMessage(nextStep)
            }
        }
    })
})


async function getNextStep(agent_execution_id,page_url, dom_content, last_action) {
    const url = "http://localhost:3000/api/web_interactor/get_next_action"
    const formData = new FormData()
    formData.append('dom_content', dom_content);
    formData.append('agent_execution_id', agent_execution_id);
    formData.append('last_action_status', true)
    formData.append("last_action", last_action)
    formData.append("page_url" , page_url)
    let data = null
    try {
        const res  = await fetch(url, {
            method:"POST",
            mode:"cors",
            body:formData,
            headers: {'Content-Type': 'application/x-www-form-urlencoded'}
        })
        data = await res.json()
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