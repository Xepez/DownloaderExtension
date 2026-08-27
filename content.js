/*

TODO List:
- Test Imgur comment download
- Try to get file type reader working
- Continue to clean-up background.js

*/

const TypeOfPostEnum = Object.freeze({
    Post: 'Post',
    Gallery: 'Gallery',
    Video: 'Video',
    Redgif: 'Redgif',
    Comment: 'Comment',
    CommentGallery: 'Comment Gallery',
});


// --------------------------------------------- Add To Posts/Comments/Search Results ---------------------------------------------
function addToPost(post) {
    if (!post) return;

    // Check Type of Post and Extract Post Url
    const [typeOfPost, href] = checkTypeOfPostandExtractHref(post);
    if (!typeOfPost || !href || post.querySelector(`.my-${typeOfPost}-download-btn`)) return;

    // Setup Filename
    let filename = extractFilenameFromPost(post);
    filename = sanatizeFilenameAndAttachFileType(filename, href);

    // Setup Button
    const btn = setupButton(href, typeOfPost, filename);

    // Setup Button and Append to Post
    const entry = post.querySelector('.entry');
    if (entry) entry.appendChild(btn);
}

function addToComment(comment) {
    if (!comment) return;

    // Prevent reprocessing 
    if (comment.dataset.downloadProcessed) return;
    comment.dataset.downloadProcessed = true;

    // Find links inside comments
    const links = comment.querySelectorAll('a[href]:not(.title)');
    links.forEach((link) => {
        // Check Type of Comment and Extract Comment Url
        const [typeOfPost, href] = checkTypeOfCommentandExtractHref(link);
        if (!typeOfPost || !href || comment.querySelector(`.my-${typeOfPost}-download-btn`)) return;

        // Setup Button
        const btn = setupButton(href, typeOfPost);

        // Setup Button and Append to Post
        link.appendChild(btn);
    });
}

function addToSearchResult(searchResult) {
    if (!searchResult) return;

    const searchLink = searchResult.querySelector('a.search-link');
    const searchResultFooter = searchResult.querySelector('.search-result-footer');
    const videoSearchTitle = searchResult.querySelector('a.search-title');

    if (!searchLink || !searchResultFooter) return;

    // Check Type of Post and Extract Post Url
    const [typeOfPost, href] = checkTypeOfSearchResultandExtractHref(searchLink);
    if (!typeOfPost || !href || searchResultFooter.querySelector(`.my-${typeOfPost}-download-btn`)) return;

    // Setup Filename
    let initialFilename = extractFilenameFromSearchResult(videoSearchTitle)
    filename = sanatizeFilenameAndAttachFileType(filename, href);

    // Setup Button
    const btn = setupButton(href, typeOfPost, filename);

    // Setup Button and Append to Post
    return searchResultFooter.appendChild(btn);
}

// --------------------------------------------- Download Buttons ---------------------------------------------
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

    return btn;
}

// -----------------------------
// Default button onclick
//
// btn: Button
// href: The link of the Gallery line
// customFileName (optional): The name of the file downloaded if one is provided
// -----------------------------
function createDefaultButtonOnClick(btn, href, customFileName = null) {
    btn.onclick = () => {
        browser.runtime.sendMessage({
            action: 'download',
            url: href,
            customFileName
        });
    };

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
// Comment Gallery button onclick
//
// btn: Button
// href: The link of the Gallery line
// customFileName (optional): The name of the file downloaded if one is provided
// -----------------------------
function createImgurAlbumButtonOnClick(btn, href, customFileName = null) {
    btn.onclick = () => {
        browser.runtime.sendMessage({
            action: 'downloadImgurAlbum',
            url: href,
            customFileName
        });
    };

    return btn;
}

// -----------------------------
// Handle image/video posts
// -----------------------------
function setupButton(href, typeOfPost, filename = null) {
    let btn = createDownloadButton(`Download ${typeOfPost}`, `my-${typeOfPost}-download-btn`);

    switch(typeOfPost) {
        case TypeOfPostEnum.Post:
        case TypeOfPostEnum.Comment:
            return createDefaultButtonOnClick(btn, href, filename);
        case TypeOfPostEnum.Gallery:
            return createGalleryButtonOnClick(btn, href, filename);
        case TypeOfPostEnum.Video:
            return createVideoButtonOnClick(btn, href, filename);
        case TypeOfPostEnum.Redgif:
            return createRedgifButtonOnClick(btn, href, filename);
        case TypeOfPostEnum.CommentGallery:
            return createImgurAlbumButtonOnClick(btn, href, filename);
        default:
            return;
    }
}

// --------------------------------------------- Check Type ---------------------------------------------
// -----------------------------
// Check the type of post and extract href
//
// post: Post to check against
// -----------------------------
function checkTypeOfPostandExtractHref(post) {
    let href = null;

    // Post Title Check
    const postTitleLink = post.querySelector("a.title");
    if (postTitleLink && postTitleLink?.href) 
    {
        const postTitleHref = postTitleLink?.href.toLowerCase();

        if (postTitleHref.includes('gallery')) { // Gallery Check
            return [TypeOfPostEnum.Gallery, postTitleHref];
        } else if (postTitleHref.includes('redgifs.com')) { // Redgif Check
            return [TypeOfPostEnum.Redgif, postTitleHref];
        } else if ((/\.(jpg|jpeg|png|gif|webp)$/i.test(postTitleLink?.href) ||
            postTitleLink?.href.includes('i.redd.it') ||
            postTitleLink?.href.includes('preview.redd.it') ||
            postTitleLink?.href.includes('redditmedia.com'))) 
        {
            return [TypeOfPostEnum.Post, postTitleLink?.href];        
        }
    }

    // Post Comments Check
    const commentsLink = post.querySelector('a.comments');
    if (commentsLink && commentsLink?.href) {
        // Detect Reddit-hosted video post
        const outgoingLink = post.querySelector('a.title');
        const videoTag = post.querySelector('video');

        if (outgoingLink?.href?.includes('v.redd.it') || post.dataset.domain === 'v.redd.it' || !!videoTag) {
            return [TypeOfPostEnum.Video, commentsLink?.href];
        }
    }

    // Post Misc Check
    const postThumbnailLink = post.querySelector('a.thumbnail');
    if (postThumbnailLink && postThumbnailLink?.href && /\.(jpg|jpeg|png|gif|webp)$/i.test(postThumbnailLink?.href)) {
        return [TypeOfPostEnum.Post, postThumbnailLink?.href];
    }

    const postImageLink = post.querySelector('.expando img, .preview img');
    if (postImageLink?.src) {
        return [TypeOfPostEnum.Post, postImageLink?.src];
    }

    return [null, null];
}

// -----------------------------
// Check the type of comment and extract href
//
// comment: Comment to check against
// -----------------------------
function checkTypeOfCommentandExtractHref(comment) {
    let href = comment?.href;
    if (!href) return [null, null];

    // Match Reddit comment image/media URLs
    if((/\.(jpg|jpeg|png|gif|webp)$/i.test(comment?.href) ||
        comment?.href.includes('i.redd.it') ||
        comment?.href.includes('preview.redd.it') ||
        comment?.href.includes('redditmedia.com'))) 
    {
        return [TypeOfPostEnum.Comment, comment?.href];
    }

    // Imgur Galleries in comments
    if (/imgur\.com\/(a|gallery)\//i.test(comment?.href)) {
        return [TypeOfPostEnum.GalleryComment, comment?.href];
    }

    return [null, null];
}

// -----------------------------
// Check the type of search result and extract href
//
// searchResult: Post to check against
// -----------------------------
function checkTypeOfSearchResult(searchResult) {
    let href = searchResult?.href;
    if (!href) return [null, null];

    // Redgifs in Search Result
    if (href.includes('redgifs.com')) {
        return [TypeOfPostEnum.Redgif, href];
    }

    // Galleries in Search Result
    if (href.includes('reddit.com/gallery/')) {
        return [TypeOfPostEnum.Gallery, href];
    }

    // Video in Search Result
    if (href.includes('v.redd.it/')) {
        return [TypeOfPostEnum.Video, href];
    }

    // Images in Search Result
    if (href.includes('i.redd.it/')) {
        return [TypeOfPostEnum.Post, href];
    }

    return [null, null];
}


// --------------------------------------------- Filenames ---------------------------------------------

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
 
    // console.log(`Sanatized Name: ${filename}.${fileType}`);
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


// --------------------------------------------- PIXIV ---------------------------------------------
// Download Pixiv Posts
function addToPixivPost(post) {
    if (!post) return;

    const entry = post.querySelector('.sc-2d087ba2-0.fZymdw'); // Bottom Toolbar
    if (!entry || entry.querySelector('.download')) return;

    const btn = document.createElement('button');
    btn.innerText = 'Download';
    btn.className = 'download';
    btn.style.margin = '5px';
    btn.style.padding = '2px 5px';
    btn.style.fontSize = '11px';
    btn.style.cursor = 'pointer';

    const urlList = [];

    btn.onclick = () => {
        console.log(post);
        const images = post.querySelectorAll('.sc-a18c97f3-3.cabhzD'); // Not Expanded - potentially something to do? - '.sc-a18c97f3-3.jIaiZR'
        console.log(images);
        if (!images) return;

        images.forEach((image) => {
            if (!image.href) return;

            urlList.push(image.href);
        });

        browser.runtime.sendMessage({
            action: 'downloadPixivImages',
            url: urlList
        });

    };

    entry.appendChild(btn);
}


// --------------------------------------------- Process & Observer ---------------------------------------------
// -----------------------------
// Process everything
// -----------------------------
function processPage() {
    // Reddit Downloader
    // TODO - Split to seperate file

    // Posts
    const posts = document.querySelectorAll(
        'div.thing'
    );
    posts.forEach((post) => {
        addToPost(post);
    });

    // Comments
    const comments = document.querySelectorAll(
        '.comment'
    );
    comments.forEach((comment) => {
        addToComment(comment);
    });

    // Self Text Posts
    const selfText = document.querySelectorAll(
        '.usertext-body, .md'
    );
    selfText.forEach((text) => {
        addToComment(text);
    });

    // Search Results
    const searchResultPosts = document.querySelectorAll(
        '.search-result'
    );
    searchResultPosts.forEach((text) => {
        addToSearchResult(text);
    });


    // Pixiv Downloader
    // TODO - Split to seperate file

    const pixivPosts = document.querySelectorAll(
        '.sc-8d5ac044-1.pEkOH'
    );
    pixivPosts.forEach((post) => {
        addToPixivPost(post);
    })
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