document.addEventListener("DOMContentLoaded", () => {
    const participantsInput = document.getElementById("participantsInput");
    const prizesInput = document.getElementById("prizesInput");

    const participantsCanvas = document.getElementById("participantsWheel");
    const prizesCanvas = document.getElementById("prizesWheel");

    const participantsWrapper = document.getElementById("participantsWheelWrapper");
    const prizesWrapper = document.getElementById("prizesWheelWrapper");

    const loadListsBtn = document.getElementById("loadListsBtn");
    const spinParticipantBtn = document.getElementById("spinParticipantBtn");
    const spinPrizeBtn = document.getElementById("spinPrizeBtn");

    const winnerActions = document.getElementById("winnerActions");
    const winnerNameSpan = document.getElementById("winnerName");
    const btnNoEsta = document.getElementById("btnNoEsta");
    const btnPresente = document.getElementById("btnPresente");

    const historyList = document.getElementById("historyList");

    // Elementos del modal
    const winnerModal = document.getElementById("winnerModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalBody = document.getElementById("modalBody");
    const modalCloseBtn = document.getElementById("modalCloseBtn");

    let participants = [];
    let prizes = [];
    let winnersHistory = [];

    let currentParticipantIndex = null;   // índice del participante que salió
    let pendingHistoryIndex = null;       // índice en el historial que espera premio

    // Rotaciones acumuladas (para que gire varias vueltas)
    let participantsRotation = 0;
    let prizesRotation = 0;

    // ================== UTILIDADES ==================
    function parseInputToArray(text) {
        return text
            .split("\n")
            .map(t => t.trim())
            .filter(t => t !== "");
    }

    function updateParticipantsInput() {
        participantsInput.value = participants.join("\n");
    }

    function updatePrizesInput() {
        prizesInput.value = prizes.join("\n");
    }

    function renderHistory() {
        historyList.innerHTML = "";
        winnersHistory.forEach(entry => {
            const li = document.createElement("li");
            if (entry.prize) {
                li.textContent = `${entry.participant} → ${entry.prize}`;
            } else {
                li.textContent = `${entry.participant} → (premio pendiente)`;
            }
            historyList.appendChild(li);
        });
    }

    // ----- MODAL -----
    function showModal(title, message) {
        modalTitle.textContent = title;
        modalBody.textContent = message;
        winnerModal.classList.remove("hidden");
    }

    function hideModal() {
        winnerModal.classList.add("hidden");
    }

    modalCloseBtn.addEventListener("click", hideModal);
    // Cerrar si hace click fuera del contenido
    winnerModal.addEventListener("click", (e) => {
        if (e.target === winnerModal) {
            hideModal();
        }
    });

    // ================== DIBUJAR RULETA (CANVAS) ==================
    function drawWheel(canvas, items) {
        const ctx = canvas.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        const size = Math.min(canvas.clientWidth, canvas.clientHeight);

        canvas.width = size * dpr;
        canvas.height = size * dpr;

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const radius = (size * dpr) / 2 - 10 * dpr;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!items || items.length === 0) {
            ctx.fillStyle = "#6b7280";
            ctx.font = `${14 * dpr}px system-ui`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("Sin datos", cx, cy);
            return;
        }

        const colors = [
            "#f97316", "#22c55e", "#3b82f6",
            "#e11d48", "#a855f7", "#eab308", "#14b8a6"
        ];

        const anglePerSlice = (2 * Math.PI) / items.length;

        for (let i = 0; i < items.length; i++) {
            const startAngle = i * anglePerSlice;
            const endAngle = startAngle + anglePerSlice;

            // Sector de color
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = colors[i % colors.length];
            ctx.fill();

            // Borde del sector
            ctx.strokeStyle = "#020617";
            ctx.lineWidth = 2 * dpr;
            ctx.stroke();

            // Texto
            const textAngle = startAngle + anglePerSlice / 2;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(textAngle);

            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#f9fafb";
            ctx.font = `${11 * dpr}px system-ui`;

            const label = items[i].length > 18
                ? items[i].slice(0, 18) + "…"
                : items[i];

            ctx.fillText(label, radius - 8 * dpr, 0);
            ctx.restore();
        }
    }

    // ================== GIRO REAL HACIA EL GANADOR ==================
    /**
     * Gira la ruleta hasta que el índice elegido quede bajo la flecha.
     * La flecha está arriba (a las 12 en punto, 270°).
     */
    function spinToIndex(canvas, itemsLength, index, type, callback) {
        if (itemsLength === 0) return;

        // Cada sector ocupa este ángulo
        const sliceAngle = 360 / itemsLength;

        // Ángulo del centro del sector elegido (0° = derecha)
        const theta = (index + 0.5) * sliceAngle; // en grados

        // Ángulo de la flecha (arriba) en grados:
        // derecha = 0°, abajo = 90°, izquierda = 180°, arriba = 270°
        const pointerAngle = 270;

        let currentRotation =
            type === "participants" ? participantsRotation : prizesRotation;

        // Queremos: theta + newRotation ≡ pointerAngle (mod 360)
        // newRotation = currentRotation + delta
        let baseDelta = pointerAngle - theta - currentRotation;

        // Normalizar baseDelta a [0, 360)
        baseDelta = ((baseDelta % 360) + 360) % 360;

        // Añadimos vueltas completas para que se vea que gira
        const extraSpins = 3;
        const delta = baseDelta + extraSpins * 360;

        const newRotation = currentRotation + delta;

        if (type === "participants") {
            participantsRotation = newRotation;
        } else {
            prizesRotation = newRotation;
        }

        canvas.style.transition = "transform 1.5s ease-out";
        canvas.style.transform = `rotate(${newRotation}deg)`;

        const handler = () => {
            canvas.removeEventListener("transitionend", handler);
            if (callback) callback();
        };

        canvas.addEventListener("transitionend", handler);
    }

    // ================== EVENTOS PRINCIPALES ==================

    // Cargar listas a las ruletas
    loadListsBtn.addEventListener("click", () => {
        participants = parseInputToArray(participantsInput.value);
        prizes = parseInputToArray(prizesInput.value);

        if (participants.length === 0) {
            alert("No hay participantes. Escribe al menos uno.");
        }

        if (prizes.length === 0) {
            alert("No hay premios. Escribe al menos uno.");
        }

        // Reset rotaciones
        participantsRotation = 0;
        prizesRotation = 0;
        participantsCanvas.style.transition = "none";
        prizesCanvas.style.transition = "none";
        participantsCanvas.style.transform = "rotate(0deg)";
        prizesCanvas.style.transform = "rotate(0deg)";

        // Dibujar
        drawWheel(participantsCanvas, participants);
        drawWheel(prizesCanvas, prizes);
    });

    // Girar participantes
    spinParticipantBtn.addEventListener("click", () => {
        if (participants.length === 0) {
            alert("No hay participantes en la ruleta.");
            return;
        }

        // Solo se puede tener un ganador pendiente a la vez
        if (pendingHistoryIndex !== null) {
            alert("Primero asigna un premio al ganador pendiente.");
            return;
        }

        const index = Math.floor(Math.random() * participants.length);

        spinToIndex(
            participantsCanvas,
            participants.length,
            index,
            "participants",
            () => {
                currentParticipantIndex = index;
                const winnerName = participants[index];
                winnerNameSpan.textContent = winnerName;
                winnerActions.classList.remove("hidden");

                // Popup en vez de alert
                showModal("Ganador", `El ganador es: ${winnerName}`);
            }
        );
    });

    // Botón "Borrar / No está"
    btnNoEsta.addEventListener("click", () => {
        if (currentParticipantIndex === null) return;

        // Eliminar de la lista de participantes
        participants.splice(currentParticipantIndex, 1);
        updateParticipantsInput();
        drawWheel(participantsCanvas, participants);

        currentParticipantIndex = null;
        winnerActions.classList.add("hidden");
    });

    // Botón "Presente (asignar premio)"
    btnPresente.addEventListener("click", () => {
        if (currentParticipantIndex === null) return;

        const winnerName = participants[currentParticipantIndex];

        // Quitar de participantes
        participants.splice(currentParticipantIndex, 1);
        updateParticipantsInput();
        drawWheel(participantsCanvas, participants);

        // Guardar en historial como "pendiente de premio"
        const entry = {
            participant: winnerName,
            prize: null
        };
        winnersHistory.push(entry);
        pendingHistoryIndex = winnersHistory.length - 1;
        renderHistory();

        // Limpiar estado de ganador actual
        currentParticipantIndex = null;
        winnerActions.classList.add("hidden");

        // Mostrar ruleta de premios
        participantsWrapper.classList.add("hidden");
        prizesWrapper.classList.remove("hidden");

        // Redibujar la ruleta de premios ahora que es visible
        setTimeout(() => {
            drawWheel(prizesCanvas, prizes);
        }, 0);
    });

    // Girar premios
    spinPrizeBtn.addEventListener("click", () => {
        if (pendingHistoryIndex === null) {
            alert("Primero selecciona un participante ganador.");
            return;
        }
        if (prizes.length === 0) {
            alert("No hay premios en la ruleta.");
            return;
        }

        const prizeIndex = Math.floor(Math.random() * prizes.length);

        spinToIndex(
            prizesCanvas,
            prizes.length,
            prizeIndex,
            "prizes",
            () => {
                const prizeName = prizes[prizeIndex];

                // Popup en vez de alert
                showModal("Premio", `El premio es: ${prizeName}`);

                // Asignar premio al último ganador pendiente
                winnersHistory[pendingHistoryIndex].prize = prizeName;
                pendingHistoryIndex = null;
                renderHistory();

                // Quitar premio de la lista
                prizes.splice(prizeIndex, 1);
                updatePrizesInput();
                drawWheel(prizesCanvas, prizes);

                // Volver a mostrar ruleta de participantes
                prizesWrapper.classList.add("hidden");
                participantsWrapper.classList.remove("hidden");
            }
        );
    });

    // Dibujo inicial vacío
    drawWheel(participantsCanvas, []);
    drawWheel(prizesCanvas, []);
});
