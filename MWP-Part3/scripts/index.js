/**
 * Scripts specific to index.html.
 */

$(document).ready(function(e) {
    // declare dependency on other script
    var script = 'scripts/flickr.js';
    $("head").append('<script type="text/javascript" src="' + script + '"></script>');

    // Allow drop on the bulletin board by preventing default behavior.
    $('#bulletin').on('dragover', function(e) {
        e.preventDefault();
    });

    // Move element to where it is dropped.
    $('#bulletin').on('drop', function(e) {
        e.preventDefault();
        var $elementId = e.originalEvent.dataTransfer.getData('text');
        e.originalEvent.target.appendChild(document.getElementById($elementId));
        // Insert a push-pin.
        var $pushPin = $('<div/>', { class: 'push-pin' });
        var $flipper = $('#' + $elementId);
        $pushPin.insertBefore($flipper);

        // Add a random rotation to the picture when posted on the cork board.
        var $rotation = getRandomInt(-3, 4);
        $flipper.css('transform', 'rotate(' + $rotation + 'deg)');

        // Store the photo ID in local storage.
        savePhoto($elementId);

        //// Horizontally center push-pin (now done using CSS)
        //$pushPin.css('left', ($flipper.outerWidth() / 2) - ($pushPin.width() / 2));

        // assign event handler for push-pin click
        $pushPin.on('click', function(e) {
            // Apply fade-out effect to indicate that the push-pin is removed.
            $pushPin.addClass('fadeout');
        });

        // Delay removal of photo element till the animation has ended.
        var $animationEndHandler = function (e) {
            console.log('animation ended');
            // Remove self (i.e. the push-pin) from DOM.
            $(this).remove();

            // Remove photo from DOM after playing an animation that simulates the image falling.
            var $photoAnimationEndHandler = function (e) {
                $(this).remove();
            };
            $flipper.on('webkitAnimationEnd', $photoAnimationEndHandler);
            $flipper.on('animationend', $photoAnimationEndHandler);
            $flipper.addClass('falling');

        };
        // Assign event handler (Chrome)
        $pushPin.on('webkitAnimationEnd', $animationEndHandler);
        // Assign event handler (General)
        $pushPin.on('animationend', $animationEndHandler);
    });
});

var photoPagesRequested = 1;

$(document).on('submit', '#formSearchFlickr', function(e) {
    // Block regular form submit that causes a page reload.
    e.preventDefault();
    // fetch the search term.
    var searchTerm = $('#inputSearchTerm').val();
    searchFlickr(searchTerm, 10, photoPagesRequested, function(data) {
        // Create a new element to display each image.
        $.each(data.photos.photo, function(i, photo) {
            // Build the URL for the image.
            var $imgUrl = 'http://farm' + photo.farm + '.staticflickr.com/' + photo.server + '/' + photo.id + '_' + photo.secret + '_n.jpg';
            // Create a container and append it to the DOM.
            var $resultContainer = $('<div/>', { class: 'search-result' });
            $('#search-results-container').append($resultContainer);
            // Create the image element and append it to the container element.
            createPhotoElement($resultContainer, $imgUrl, photo.id);
        });
    });
    photoPagesRequested++;
});

/**
 * Creates a photo element and appends it to $parentElem, i.e. the created element is not returned.
 * @param $parentElem The parent element that the photo is to be appended to.
 * @param $photoUrl The URL of the flickr photo.
 * @param $flickrPhotoId The flickr ID of the photo.
 */
function createPhotoElement($parentElem, $photoUrl, $flickrPhotoId) {
    var $front = $('<div/>');
    var $image = $('<img/>', { src: $photoUrl });
    var $back = $('<div/>');
    var $btnLocation = $('<input/>', { type: 'image', src: 'images/location-icon.png', class: 'btn-flip', alt: 'Photo Location.'});
    var $btnImage = $('<input/>', { type: 'image', src: 'images/flip-icon.png', class: 'btn-flip', alt: 'Photo.'});

    // Flip image when location button is clicked.
    $btnLocation.on('click', function(e) {
        e.preventDefault();
        $(this).parents('.flipper').addClass('flipped');
    });
    // Flip from map to image when flip button is clicked.
    $btnImage.on('click', function(e) {
        e.preventDefault();
        $(this).parents('.flipper').removeClass('flipped');
    });

    $back.css('overflow', 'hidden');
    $back.append($btnImage);

    // Create flipping image.
    $front.append($image);
    $front.append($btnLocation);
    var $flipper = createFlipper($front, $back);
    // Add an ID (for drag and drop)
    $flipper.attr('id', $flickrPhotoId);
    // Set draggable
    $flipper.attr('draggable', 'true');
    // Set what is dragged
    $flipper.on('dragstart', function(e) {
        // Keep reference to ID of dragged element.
        e.originalEvent.dataTransfer.setData('text', $(this).attr('id'));
    });

    // Add element to DOM.
    $parentElem.append($flipper);
    // Image height and width is first available when image has loaded.
    $image.one('load', function(e) {
        // Update size of container to fit contents...
        $flipper.height($front.outerHeight(true));
        // Width is constrained by the width of the flickr image.
        // For some reason $front.outerWidth(true) does not take the actual width of the image into account.
        // Hence we must manually compute the width and add margins like so:
        var $w = $(this).width() + $front.outerWidth(true) - $front.outerWidth();
        $flipper.css('width', $w);

        var $imgWidth = $(this).width();
        var $imgHeight = $(this).height();

        // AJAX call: get location data and create a map to show where photo was shot.
        getPhotoLocation($flickrPhotoId, function(response) {
            if (response.stat === 'ok') {
                // Location data available.
                // Create map element and append to back element.
                var latLng = new google.maps.LatLng(parseFloat(response.photo.location.latitude), parseFloat(response.photo.location.longitude));
                var mapOptions = {
                    center: latLng,
                    zoom: 10
                };
                var $mapDiv = $('<div/>');
                // Set size of map to match that of the image on the front.
                $mapDiv.width($imgWidth);
                $mapDiv.height($imgHeight);
                var map = new google.maps.Map($mapDiv[0], mapOptions);
                // Set a marker to display exact photo location.
                var marker = new google.maps.Marker({
                    position: latLng,
                    map: map,
                    title: 'Photo location.'
                });
                $back.prepend($mapDiv);
            } else {
                // Simplified error handling.
                var $errMsg = $('<p>No location data available Q_Q</p>');
                $back.prepend($errMsg);
                $errMsg.width($imgWidth);
                $errMsg.height($imgHeight);
                $errMsg.css('margin', '0');
                $back.css('color', 'white');
            }
        });
    });
}

/**
 * Constructs an element that is flipped to display its back when hovered.
 * Note that the returned element relies on the CSS3 defined in flipper.css.
 * @param $frontContents The contents to display when not hovering the element.
 * @param $backContents The contents to display when hovering the element.
 * @returns {*|jQuery|HTMLElement} The 'flipper' element.
 */
function createFlipper($frontContents, $backContents) {
    var $flipperContainer = $('<div/>', { class: 'flipper-container'});
    var $flipper = $('<div/>', { class: 'flipper'});
    var $flipperFront = $('<div/>', { class: 'flipper-front'});
    var $flipperBack = $('<div/>', { class: 'flipper-back'});

    $flipperFront.append($frontContents);
    $flipperBack.append($backContents);

    $flipper.append($flipperFront);
    $flipper.append($flipperBack);

    $flipperContainer.append($flipper);

    return $flipperContainer;
}

/**
 * Stores the ID of flickr photo in local storage.
 * @param $photoId The ID of the flickr photo.
 */
function savePhoto($photoId) {
    // Check if local storage is supported.
    if(typeof(Storage) !== "undefined") {
        // Code for localStorage/sessionStorage.
        var key;
        if(localStorage.photoKeyCount) {
            // New key is the current count of keys plus one.
            key = Number(localStorage.photoKeyCount) + 1;
        } else {
            // No keys yet, start from 1.
            key = 1;
        }
        // Store the photo ID.
        localStorage.key = $photoId;
        // Update the key count.
        localStorage.photoKeyCount = key;
    } else {
        alert('Sorry, browser does not support locally storing photos.');
    }
}

/**
 * Fills the cork board with photos based on locally stored photo IDs.
 */
function initCorkBoard() {
    if(typeof(Storage) !== "undefined") {
        // Fetch the key count.
        var keyCount;
        if (localStorage.photoKeyCount) {
            keyCount = Number(localStorage.photoKeyCount);
        } else {
            // No photos stored yet.
            keyCount = 0;
        }
        // Create a photo element for every key found.
        for (var key = 1; key <= keyCount; key++) {
            if (localStorage.key) {
                // Retrieve the flickr photo ID.
                var $flickrId = localStorage.key;
                // Build the photo flipper element

            } else {
                // Photo was removed.
            }
        }
    }
}

/**
 * Courtesy of https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
 *
 * Returns a random integer between min (inclusive) and max (inclusive)
 * Using Math.round() will give you a non-uniform distribution!
 */
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function computeHeight($parent) {
    var $result = 0;
    // sum width of children
    $parent.children().each(function () {
        $result += $(this).outerHeight(true);
    });
    // add parent margin
    $result += $parent.outerHeight(true) - $parent.outerHeight();
    return $result;
}

function removePhoto($photoElementId) {
    var $photo = $('#' + $photoElementId);
    $photo.remove();
}