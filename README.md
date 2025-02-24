# Tax2Ready
ระบบนี้ถูกพัฒนามาเพื่อเสริมสร้างความรู้ในด้านภาษีสำหรับบุคคลธรรมดา

curl --location 'localhost:8080/users/login' \
--header 'Content-Type: application/json' \
--header 'Authorization: Basic YWRtaW5UYXg6YWRtaW4h' \
--data '{
"username": "johndoe123",
"password": "securePassword123"
}'

<script>
document.getElementById("loginForm").addEventListener("submit", async function(event) {
    event.preventDefault(); // Prevent default form submission

    // Get form values
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    // API URL
    const url = "http://localhost:8080/users/login";

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Basic YWRtaW5UYXg6YWRtaW4h"
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Store JWT in localStorage
            localStorage.setItem("jwt_token", data.token);
            alert("Login successful!");
            // Redirect or perform any action after successful login
        } else {
            alert("Login failed: " + (data.message || "Invalid credentials"));
        }
    } catch (error) {
        console.error("Error logging in:", error);
        alert("An error occurred. Please try again.");
    }
});
</script>