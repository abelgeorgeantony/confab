document.addEventListener("DOMContentLoaded", async () => {
  // First, require auth before doing anything
  await requireAuth();

  // Load the user's profile data
  await loadUserProfile();

  showStatusBarBackButton(() => {
    window.location.replace("../chat/chat.html");
  });
  // Attach button events
  document.getElementById("logout-btn").addEventListener("click", logoutUser);
  document
    .getElementById("edit-btn")
    .addEventListener("click", () => toggleEditMode(true));
  document
    .getElementById("cancel-btn")
    .addEventListener("click", () => toggleEditMode(false));
  document.getElementById("save-btn").addEventListener("click", updateProfile);
});

// Listen for when a file is selected in the input
document
  .getElementById("pfp-input")
  .addEventListener("change", function (event) {
    // Get the selected file from the event
    const file = event.target.files[0];

    // Check if a file was actually selected
    if (file) {
      // Create a new FileReader object
      // This object allows web applications to asynchronously read the contents of files
      const reader = new FileReader();

      // Set up the function to run when the reader has finished loading the file
      reader.onload = function (e) {
        // Update the 'src' attribute of the image preview element
        // e.target.result contains the data URL representing the file's data
        document.getElementById("pfp-preview").src = e.target.result;
      };

      // Start reading the file as a Data URL.
      // This will trigger the 'onload' event once it's done.
      reader.readAsDataURL(file);
    }
  });

// A store for the original data to revert on cancel
let originalProfileData = {};

function toggleEditMode(isEditing) {
  const form = document.getElementById("profile-form");
  const fields = [
    "profile-display-name",
    "profile-username",
    "pfp-preview",
    "profile-bio",
  ];

  fields.forEach((id) => {
    const element = document.getElementById(id);
    if (isEditing) {
      if (element.id === "pfp-preview") {
        originalProfileData[id] = element.src;
        document.getElementById("pfp-preview").onclick = () => {
          document.getElementById("pfp-input").click();
        };
        //element.disabled = false;
        return;
      }
      if (element.id === "profile-username") {
        const username_feedback = document.createElement("div");
        username_feedback.id = "username-feedback";
        username_feedback.className = "feedback";
        document
          .getElementById("profile-username")
          .parentElement.appendChild(username_feedback);
        document.getElementById("profile-username").onkeyup = async () => {
          document.getElementById("username-feedback").innerHTML = "";
          if (element.value !== originalProfileData[id]) {
            const available = await checkUsernameAvailability(element.value);
            if (!available) {
              document.getElementById("save-btn").disabled = true;
            } else {
              document.getElementById("save-btn").disabled = false;
            }
          } else {
            document.getElementById("save-btn").disabled = false;
          }
        };
      }
      // Store original values before enabling edit
      originalProfileData[id] = element.value;
      element.readOnly = false;
    } else {
      if (element.id === "pfp-preview") {
        document.getElementById("pfp-preview").onclick = () => {};
        element.src = originalProfileData[id];
        return;
      }
      if (element.id === "profile-username") {
        document.getElementById("username-feedback").remove();
      }
      // Restore original values on cancel
      element.value = originalProfileData[id] || "";
      element.readOnly = true;
    }
  });

  // Toggle button visibility
  document.getElementById("edit-btn").style.display = isEditing
    ? "none"
    : "block";
  document.getElementById("save-btn").style.display = isEditing
    ? "block"
    : "none";
  document.getElementById("cancel-btn").style.display = isEditing
    ? "block"
    : "none";
}

async function loadUserProfile() {
  const token = getCookie("auth_token");
  if (!token) return;

  try {
    // YOU WILL NEED TO CREATE 'get_profile.php' on your backend
    const res = await fetch(API + "fetch_profile.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();

    if (data.success) {
      document.getElementById("profile-display-name").value =
        data.user.display_name;
      document.getElementById("profile-username").value = data.user.username;
      document.getElementById("profile-email").value = data.user.email;
      document.getElementById("pfp-preview").src =
        "../" + data.user.profile_picture_url;
      document.getElementById("profile-bio").value = data.user.bio;

      document
        .getElementById("reset-password-btn")
        .addEventListener("click", async () => {
          const res = await fetch(API + "forgot_password.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: data.user.username }),
          });
          const result = await res.json();
          alert(
            "The link for the password reset has been sent to your email. We will now take you directly to the password reset page!",
          );
          if (result.success) {
            window.location.replace(result.link);
          }
        });
    } else {
      alert("Could not load profile data.");
    }
  } catch (err) {
    console.error("Error loading profile:", err);
  }
}

async function updateProfile() {
  const token = getCookie("auth_token");

  const formData = new FormData();
  formData.append("token", token);
  formData.append(
    "display_name",
    document.getElementById("profile-display-name").value,
  );
  formData.append(
    "username",
    document.getElementById("profile-username").value,
  );
  formData.append(
    "profile_picture",
    document.getElementById("pfp-input").files[0],
  );
  formData.append("bio", document.getElementById("profile-bio").value);

  try {
    const res = await fetch(API + "update_profile.php", {
      method: "POST",
      body: formData,
    });

    const result = await res.json();

    if (result.success) {
      alert("Profile updated successfully!");
      toggleEditMode(false); // Exit edit mode
      await loadUserProfile(); // Reload data to confirm
    } else {
      alert("Update failed: " + (result.error || "Unknown error"));
    }
  } catch (err) {
    console.error("Update error:", err);
  }
}

function logoutUser() {
  if (confirm("Do you really want to logout?")) {
    deleteCookie("auth_token");
    localStorage.clear();
    window.location.replace("../auth/login.html");
  }
}
