let counter = 0;

setInterval(() => {
    document.getElementById("hi").textContent = counter++;
}, 1000)