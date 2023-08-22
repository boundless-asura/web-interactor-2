chrome.runtime.onConnect.addListener(function(port) {
    console.assert(port.name === "knockknock");
    port.onMessage.addListener(async function(request) {
        console.log("message recieved from content",request)
        // if (request.type == null )
        //     {sendResponse({success:false});
        //     return }
        // if (request.type == "TRIGGER") {
        //     sendResponse({success:true})
        // }
        
        if (request.dom_content.length > 0)
        {
            // urlC
            console.log("arrived 1")
            // const body={
            //     dom_content:encodeURIComponent(request)
            //     agent_execution_id:request.agent_execution_id,
            //     last_action_status:true
            // }
    
            console.log("arrived 2")
    
            // Append form fields
            const formData = new FormData()
            formData.append('dom_content', request.dom_content);
            formData.append('agent_execution_id', request.agent_execution_id);
            formData.append('last_action_status', true)
            formData.append("last_action", request.last_action)
            formData.append("page_url" , request.page_url)
            console.log("REQUEST",request)
            const url = 'http://localhost:3000/api/web_interactor_next_action';
            try {
                const res  = await fetch(url, {
                    method:"POST",
                    mode:"cors",
                    body:formData,
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'}
                })
                const data = await res.json()
                port.postMessage(data)
    
                console.log("arriveddddd",data)
            }
            catch (err) {
                console.error("CHECK tIS", err)
            }
            
    
            
    
            // const response = await res.json()
            console.log("arrived 4")
        }
        
    });
  });
chrome.runtime.onMessage.addListener( async function(request, sender, sendResponse) {
    
    
});


// Define the URL for the POST request

// Define the headers for the request
// const headers = {
//   'Content-Type': 'application/json',
//   'Authorization': 'Bearer your_access_token_here'
// };

// Define the data to be sent in the request body
const data = {
  dom_content: 'value1',
  key2: 'value2'
};

// Make the POST request using Axios