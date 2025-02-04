document.addEventListener("DOMContentLoaded", function () {
    console.log("Trying to load header...");

    fetch("components/header.html")
        .then(response => response.text())
        .then(data => {
            document.getElementById("header-container").innerHTML = data;
            console.log("Header Loaded");

            // ใช้ setTimeout เพื่อรอให้ DOM อัพเดตก่อนเรียก attachEventListeners()
            setTimeout(attachEventListeners, 100);
        })
        .catch(error => console.error("Error loading header:", error));
});

function attachEventListeners() {
    console.log("Attaching event listeners...");

    document.getElementById("mobile-menu-button").addEventListener("click", function() {
        document.getElementById("mobile-menu").classList.toggle("hidden");
    });
}
