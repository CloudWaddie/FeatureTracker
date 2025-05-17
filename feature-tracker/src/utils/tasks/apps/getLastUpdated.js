export default async function getLastUpdated(app) { // <-- Make the function async
    console.log("Checking for last updated date for ...");
  
    try {
      const response = await fetch(`${process.env.DOMAIN}/api/db/getLastUpdated?appId=${app}`); // <-- await the fetch call
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json(); // <-- await parsing the JSON response

      // Check if lastUpdated is null or undefined
      if (data.lastUpdated === null || data.lastUpdated === undefined) {
        console.warn("No last updated date found for this app. Defaulting to 0.");
        data.lastUpdated = 0; // Set to 0 if not found
      }
      return data;
  
    } catch (error) {
      console.error("Error checking for updates:", error); // <-- Log any errors
      return "Error checking for updates."; // <-- Return an error message
    }
  }