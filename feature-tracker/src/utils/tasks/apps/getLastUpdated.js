export default async function getLastUpdated() { // <-- Make the function async
    console.log("Checking for last updated date for ...");
  
    try {
      const response = await fetch(`${process.env.DOMAIN}/api/db/getLastUpdated?appId=com.deepseek.chat`); // <-- await the fetch call
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json(); // <-- await parsing the JSON response

      return data;
  
    } catch (error) {
      console.error("Error checking for updates:", error); // <-- Log any errors
      return "Error checking for updates."; // <-- Return an error message
    }
  }