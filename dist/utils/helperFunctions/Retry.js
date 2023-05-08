export async function retry(func, maxRetries = 12, retryDelay = 1000) {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            return await func();
        }
        catch (error) {
            if (error instanceof Error)
                console.log("Error message:", error.message);
            if (error instanceof Error && (error.message.includes("timeout") || error.message.includes("Invalid JSON RPC response"))) {
                retries++;
                if (retries < maxRetries) {
                    await new Promise((resolve) => setTimeout(resolve, retryDelay));
                }
            }
            else {
                throw error;
            }
        }
    }
    throw new Error("Maximum retries reached");
}
//# sourceMappingURL=Retry.js.map