/*

TODO List:
- Test Imgur comment download
- Try to get file type reader working
- Continue to clean-up background.js

*/

const TypeOfPostEnum = Object.freeze({
    Post: 0,
    Gallery: 1,
    Video: 2,
    Redgif: 3,
    Comment: 4,
    GalleryComment: 5,
    SearchResult: 6,
    SearchResultRedgif: 7,
    SearchResultGallery: 8,
    SearchResultVideo: 9,
    SearchResultImage: 10
});


// --------------------------------------------- Add Buttons to Specific Types of Posts ---------------------------------------------
// -----------------------------
// Handle image/video posts
// -----------------------------
function addDownloadButtonToPost(post) {
    if (post.querySelector('.my-download-btn')) return;

    // Check Type of Post
    const [type, href]  = checkTypeOfPost(post, TypeOfPostEnum.Post);
    if (type != TypeOfPostEnum.Post) return;

    // Setup Filename
    let filename = extractFilenameFromPost(post);
    filename = sanatizeFilenameAndAttachFileType(filename, href);

    // Setup Button and Append to Post
    const entry = post.querySelector('.entry');
    if (entry) entry.appendChild(createDownloadButton('Download Image', 'my-download-btn', 'download', href, filename));
}

// -----------------------------
// Handle Reddit galleries
// -----------------------------
function addDownloadButtonToGallery(post) {
    if (post.querySelector('.my-gallery-download-btn')) return;

    // Check Type of Post
    const [type, href] = checkTypeOfPost(post, TypeOfPostEnum.Gallery);
    if (type != TypeOfPostEnum.Gallery) return;

    // Setup Filename
    let filename = extractFilenameFromPost(post);
    filename = sanatizeFilenameAndAttachFileType(filename, href);

    // Setup Button
    const btn = createDownloadButton('Download Gallery', 'my-gallery-download-btn');
    createGalleryButtonOnClick(btn, href, filename);

    // Append to Post
    const entry = post.querySelector('.entry');
    if (entry) entry.appendChild(btn);
}

// -----------------------------
// Handle video posts
// -----------------------------
function addDownloadButtonToVideo(post) {
    // Prevent Duplicates
    if (post.querySelector('.my-video-download-btn')) return;

    // Check Type of Post
    const [type, href] = checkTypeOfPost(post, TypeOfPostEnum.Video);
    if (type != TypeOfPostEnum.Video) return;

    // Setup Filename
    let filename = extractFilenameFromPost(post);
    filename = sanatizeFilenameAndAttachFileType(filename, href);

    // Setup Button
    const btn = createDownloadButton('Download Video', 'my-video-download-btn');
    createVideoButtonOnClick(btn, href, filename);

    // Append to Post
    const entry = post.querySelector('.entry');
    if (entry) entry.appendChild(btn);
}

// -----------------------------
// Handle Redgifs posts
// -----------------------------
function addDownloadButtonToRedgifs(post) {
    // Prevent duplicate buttons
    if (post.querySelector('.my-redgifs-download-btn')) return;

    // Check Type of Post
    const [type, href] = checkTypeOfPost(post, TypeOfPostEnum.Redgif);
    if (type != TypeOfPostEnum.Redgif) return;

    // Setup Filename
    let filename = extractFilenameFromPost(post);
    filename = sanatizeFilenameAndAttachFileType(filename, href);

    // Setup Button
    const btn = createDownloadButton('Download Redgifs', 'my-redgifs-download-btn');
    createRedgifButtonOnClick(btn, href, filename);

    // Append to Post
    const entry = post.querySelector('.entry');
    if (entry) entry.appendChild(btn);
}

// -----------------------------
// Handle comment images
// -----------------------------
function addDownloadButtonToComment(comment) {
    // Prevent reprocessing
    if (comment.dataset.downloadProcessed) return;
    comment.dataset.downloadProcessed = true;

    // Find links inside comments
    const links = comment.querySelectorAll('a[href]:not(.title)');

    links.forEach((link) => {
        // Prevent duplicate buttons
        if (link.querySelector('.my-download-btn')) return;

        // Check Type of Post
        const [type, href] = checkTypeOfPost(link, TypeOfPostEnum.Comment);
        if (type != TypeOfPostEnum.Comment) return;
        
        // Setup Button and Append to Post
        link.appendChild(createDownloadButton('Download Image', 'my-download-btn', 'download', href));
    });
}

// TODO: Still needs additional testing to confirm working
// -----------------------------
// Handle Imgur albums in text posts/comments
// -----------------------------
function addDownloadButtonToGalleryComment(comment) {
    // Prevent reprocessing
    if (comment.dataset.downloadProcessed) return;
    comment.dataset.downloadProcessed = true;

    const links = comment.querySelectorAll('a[href]');

    links.forEach((link) => {
        if (link.querySelector('.my-imgur-download-btn')) return;

        // Check Type of Post
        const [type, href] = checkTypeOfPost(link, TypeOfPostEnum.GalleryComment);
        if (type !== TypeOfPostEnum.GalleryComment) return;

        // Setup Button and Append to Post
        link.appendChild(createDownloadButton('Download Album', 'my-imgur-download-btn', 'downloadImgurAlbum', href));
    });
}

// -----------------------------
// Handle Search Results
// -----------------------------
function addDownloadButtonToSearchResultPost(post) {
    const searchLink = post.querySelector('a.search-link');
    const searchResultFooter = post.querySelector('.search-result-footer');
    const videoSearchTitle = post.querySelector('a.search-title');

    if (!searchLink || !searchResultFooter) return;

    // Setup Filename
    let initialFilename = extractFilenameFromSearchResult(videoSearchTitle);

    const searchResultList = [TypeOfPostEnum.SearchResultRedgif, TypeOfPostEnum.SearchResultGallery, 
        TypeOfPostEnum.SearchResultVideo, TypeOfPostEnum.SearchResultImage]

    for (let x = 0; x < searchResultList.length; x++) {
        const [type, href] = checkTypeOfPost(searchLink, searchResultList[x]);
        if (type === TypeOfPostEnum.SearchResultRedgif 
            || type === TypeOfPostEnum.SearchResultGallery
            || type === TypeOfPostEnum.SearchResultVideo 
            || type === TypeOfPostEnum.SearchResultImage
        ) {
            if (searchResultFooter.querySelector(`.my-${type}-download-btn`)) return;

            const filename = sanatizeFilenameAndAttachFileType(initialFilename, href);

            let btn = null;
            switch (type) {
                case TypeOfPostEnum.SearchResultRedgif:
                    btn = createDownloadButton('Download Redgifs', `my-${type}-download-btn`);
                    createRedgifButtonOnClick(btn, href, filename);
                    break;
                case TypeOfPostEnum.SearchResultGallery:
                    btn = createDownloadButton('Download Gallery', `my-${type}-download-btn`);
                    createGalleryButtonOnClick(btn, href, filename);
                    break;
                case TypeOfPostEnum.SearchResultVideo:
                    if (!videoSearchTitle || !videoSearchTitle.href) return;

                    btn = createDownloadButton('Download Video', `my-${type}-download-btn`);
                    createVideoButtonOnClick(btn, videoSearchTitle.href, filename);
                    break;
                case TypeOfPostEnum.SearchResultImage:
                    btn = createDownloadButton('Download Image', `my-${type}-download-btn`, 'download', href, filename);
                    break;
                default:
                    break;
            }

            if (btn === null) return;

            searchResultFooter.appendChild(btn);
        } else {
            console.log(`ERROR: Returned type of ${type}`);
        }
    }
}

// --------------------------------------------- Helpers ---------------------------------------------
// -----------------------------
// Generic button creator
//
// buttonText: Title of the button
// className: Class name of the button
// action (optional): The action to call in background.js
// url (optional): url to attach to the button (if not included will not include the onclick function)
// customFileName (optional): The name of the file downloaded if one is provided
// -----------------------------
function createDownloadButton(buttonText, className, action = null, url = null, customFileName = null) {
    const btn = document.createElement('button');
    btn.innerText = buttonText;
    btn.className = className;
    btn.style.margin = '5px';
    btn.style.padding = '2px 5px';
    btn.style.fontSize = '11px';
    btn.style.cursor = 'pointer';

    if (url !== null) {
        btn.onclick = () => {
            browser.runtime.sendMessage({
                action: action,
                url,
                customFileName
            });
        };
    }

    return btn;
}

// -----------------------------
// Gallery button onclick
//
// btn: Button
// href: The link of the Gallery line
// customFileName (optional): The name of the file downloaded if one is provided
// -----------------------------
function createGalleryButtonOnClick(btn, href, customFileName = null) {
    btn.onclick = async () => {
        try {
            // Reddit JSON endpoint
            const jsonUrl = href.replace(/\/$/, '') + '.json';

            const response = await fetch(jsonUrl);
            const data = await response.json();

            const postData = data?.[0]?.data?.children?.[0]?.data;

            if (!postData?.media_metadata) {
                console.log('No gallery metadata found');
                return;
            }

            const mediaMetadata = postData.media_metadata;

            const urls = Object.values(mediaMetadata)
                .map((item) => {
                    const source = item?.s?.u || item?.s?.gif;

                    return source ? source.replace(/&amp;/g, '&') : null;
                })
                .filter(Boolean);

            for (let i = 0; i < urls.length; i++) {
                const filename = `pg${i}_${customFileName}`

                browser.runtime.sendMessage({
                    action: 'download',
                    url: urls[i],
                    customFileName: filename
                });
            }

            console.log(`Downloaded ${urls.length} gallery images` );
        } catch (err) {
            console.error('Gallery download failed:', err);
        }
    };

    return btn;
}

// -----------------------------
// Video button onclick
//
// btn: Button
// href: The link of the Video line
// customFileName (optional): The name of the file downloaded if one is provided
// -----------------------------
function createVideoButtonOnClick(btn, href, customFileName = null) {
    btn.onclick = async () => {
        try {
            const jsonUrl = href.replace(/\/$/, '') + '.json';
            const response = await fetch(jsonUrl);

            if (!response.ok) {
                throw new Error( `HTTP ${response.status}`);
            }

            const data = await response.json();
            const postData = data?.[0]?.data?.children?.[0]?.data;

            const redditVideo = postData?.media?.reddit_video;

            if (!redditVideo?.fallback_url) {
                console.log('No Reddit video found');
                return;
            }

            const videoUrl = redditVideo.fallback_url;

            const parsed = new URL(videoUrl);

            const baseUrl = parsed.origin + parsed.pathname.substring(0, parsed.pathname.lastIndexOf('/') + 1);

            const audioCandidates = [
                // DASH
                `${baseUrl}DASH_AUDIO_128.mp4`,
                `${baseUrl}DASH_AUDIO.mp4`,
                `${baseUrl}DASH_audio.mp4`,

                // CMAF
                `${baseUrl}CMAF_AUDIO_128.mp4`,
                `${baseUrl}CMAF_AUDIO.mp4`,

                // fallback
                `${baseUrl}audio`
            ];

            browser.runtime.sendMessage({
                action: 'downloadVideoWithAudio',
                videoUrl,
                audioCandidates,
                customFileName
            });

        } catch (err) {
            console.error('Video download failed:', err);
        }
    };

    return btn;
}

// -----------------------------
// Redgif button onclick
//
// btn: Button
// href: The link of the Redgif line
// customFileName (optional): The name of the file downloaded if one is provided
// -----------------------------
function createRedgifButtonOnClick(btn, href, customFileName = null) {
    btn.onclick = async () => {
        try {
            console.log('Sending Redgifs download:', href);

            browser.runtime.sendMessage({
                action: 'downloadRedgifs',
                url: href,
                customFileName
            });

        } catch (err) {
            console.error('Redgifs download failed:', err);
        }
    };

    return btn;
}

// -----------------------------
// Check the type of post and extract href
//
// post: Post to check against
// postToCheckList: Type of post to check against
// -----------------------------
function checkTypeOfPost(post, postToCheckList) {
    let href = null;

    switch (postToCheckList) {
        case TypeOfPostEnum.Post:
            // Check for thumbnail
            const thumbnailLink = post.querySelector('a.thumbnail');
            if (thumbnailLink 
                && thumbnailLink.href
                && /\.(jpg|jpeg|png|gif|webp)$/i.test(thumbnailLink.href)
            ) {
                href = thumbnailLink.href;
            }

            // Check for image expando's / preview's
            if(!href) {
                const imageLink = post.querySelector('.expando img, .preview img');
                if (imageLink?.src) {
                    href = imageLink.src;
                }
            }

            // Check for title images (Exclude other types of media that are not images) // TODO Could be cleaned up / more generic
            if (!href) {
                const titleLink = post.querySelector('a.title');
                if (titleLink?.href 
                    && !titleLink.href.includes("gallery") 
                    && !titleLink.href.includes('v.redd.it')
                    && !titleLink.href.includes('redgifs.com')) {
                    href = titleLink.href;
                }
            }

            if (href) return [postToCheckList, href];

            break;
        case TypeOfPostEnum.Gallery:
            // Gallery
            const galleryLink = post.querySelector("a.title");
            if (galleryLink?.href && galleryLink?.href.includes("gallery")) 
            {
                return [postToCheckList, galleryLink?.href];
            }

            break;
        case TypeOfPostEnum.Video:
            // Video
            const commentsLink = post.querySelector('a.comments');
            if (commentsLink?.href) {
                // Detect Reddit-hosted video post
                const outgoingLink = post.querySelector('a.title');
                const videoTag = post.querySelector('video');

                const isRedditVideo =
                    outgoingLink?.href?.includes('v.redd.it') ||
                    post.dataset.domain === 'v.redd.it' ||
                    !!videoTag;


                if (isRedditVideo) return [postToCheckList, commentsLink?.href];
            }

            break;
        case TypeOfPostEnum.Redgif:
            // Redgifs
            const titleLink = post.querySelector('a.title');
            if (titleLink?.href && titleLink.href.toLowerCase().includes('redgifs.com')) {
                return [TypeOfPostEnum.Redgif, titleLink?.href];
            }

            break;
        case TypeOfPostEnum.Comment:
            // Match Reddit comment image/media URLs
            if(post?.href &&
                (/\.(jpg|jpeg|png|gif|webp)$/i.test(post?.href) ||
                post?.href.includes('i.redd.it') ||
                post?.href.includes('preview.redd.it') ||
                post?.href.includes('redditmedia.com'))) 
            {
                return [postToCheckList, post?.href];
            }

            break;
        case TypeOfPostEnum.GalleryComment:
            // Imgur Galleries in comments
            if (/imgur\.com\/(a|gallery)\//i.test(post.href)) {
                return [postToCheckList, post.href];
            }
            
            break;
        case TypeOfPostEnum.SearchResultRedgif:
            // Redgifs in Search Result
            if (post.href) {
                if (post.href.includes('redgifs.com')) {
                    return [postToCheckList, post.href];
                }
            }
            
            break;
        case TypeOfPostEnum.SearchResultGallery:
            // Galleries in Search Result
            if (post.href) {
                if (post.href.includes('reddit.com/gallery/')) {
                    return [postToCheckList, post.href];
                }
            }
            
            break;
        case TypeOfPostEnum.SearchResultVideo:
            // Video in Search Result
            if (post.href) {
                if (post.href.includes('v.redd.it/')) {
                    return [postToCheckList, post.href];
                }
            }
            
            break;
        case TypeOfPostEnum.SearchResultImage:
            // Images in Search Result
            if (post.href) {
                if (post.href.includes('i.redd.it/')) {
                    return [postToCheckList, post.href];
                }
            }
            
            break;
        default:
            return [null,  ''];
    }
            
    return [null,  ''];

}

// Extract the post title from a post
function extractFilenameFromPost(post) {
    if (!post) return;

    let retTitle;
    const title = post.querySelector('a.title');
    if (title.innerText) {
        retTitle = title.innerText;
    }

    return retTitle;
}

// Extract the post title from a search result
function extractFilenameFromSearchResult(searchResultTitle) {
    if (!searchResultTitle) return;

    let retTitle;
    if (searchResultTitle.innerText) {
        retTitle = searchResultTitle.innerText;
    }

    return retTitle;
}

// Clean up custom file names and attach the type of file to the filename from the url
function sanatizeFilenameAndAttachFileType (filename, url) {
    const fileType = 'png'; //getFileType(url);
    filename = sanatizeFilename(filename);
 
    console.log(`Sanatized Name: ${filename}.${fileType}`);

    return `${filename}.${fileType}`;
}


// Source: https://stackoverflow.com/questions/8485027/javascript-url-safe-filename-safe-string/8485137#8485137
function sanatizeFilename(filename) {
    return filename.replaceAll(" ", "_").replace(/[^a-z0-9_-]/gi, '').toLowerCase();
}

// TODO - Do I need this?
// Source: https://stackoverflow.com/questions/190852/how-can-i-get-file-extensions-with-javascript/12900504#12900504
function getFileType(url) {
    return url.slice((url.lastIndexOf(".") - 1 >>> 0) + 2);
}

// --------------------------------------------- Process & Observer ---------------------------------------------
// -----------------------------
// Process everything
// -----------------------------
function processPage() {
    // Posts
    const posts = document.querySelectorAll(
        'div.thing'
    );
    posts.forEach((post) => {
        addDownloadButtonToPost(post);
        addDownloadButtonToGallery(post);
        addDownloadButtonToVideo(post);
        addDownloadButtonToRedgifs(post);
    });

    // Comments
    const comments = document.querySelectorAll(
        '.comment'
    );
    comments.forEach((comment) => {
        addDownloadButtonToComment(comment);
        addDownloadButtonToGalleryComment(comment);
    });

    // Self Text Posts
    const selfText = document.querySelectorAll(
        '.usertext-body, .md'
    );
    selfText.forEach((text) => {
        addDownloadButtonToGalleryComment(text);
    });

    // Search Results
    const searchResultPosts = document.querySelectorAll(
        '.search-result'
    );
    searchResultPosts.forEach((text) => {
        addDownloadButtonToSearchResultPost(text);
    });
}

// -----------------------------
// Observe DOM changes
// -----------------------------
const observer = new MutationObserver(() => {
    processPage();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Initial run
processPage();