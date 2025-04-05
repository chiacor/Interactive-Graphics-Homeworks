// bgImg is the background image to be modified.
// fgImg is the foreground image.
// fgOpac is the opacity of the foreground image.
// fgPos is the position of the foreground image in pixels. It can be negative and (0,0) means the top-left pixels of the foreground and background are aligned.
function composite( bgImg, fgImg, fgOpac, fgPos )
{
    // arrays storing the pixel data for each image
    let bgData = bgImg.data;
    let fgData = fgImg.data;

    // width and height of both images
    let bgWidth = bgImg.width;
    let bgHeight = bgImg.height;
    let fgWidth = fgImg.width;
    let fgHeight = fgImg.height;

    // starting position of the foreground image
    let startX = fgPos.x;
    let startY = fgPos.y;

    for (let y=0; y<fgHeight; y++) {

        for(let x=0; x<fgWidth; x++) {

            let fgIndex = (y * fgWidth + x) * 4;
            let bgX = startX + x;
            let bgY = startY + y;

            if (bgX < 0 || bgX >=bgWidth || bgY < 0 || bgY >= bgHeight) {
                continue;
            }

            let bgIndex = (bgY * bgWidth + bgX) * 4;
            
            let fgR = fgData[fgIndex];
            let fgG = fgData[fgIndex + 1];
            let fgB = fgData[fgIndex + 2];
            let fgA = fgData[fgIndex + 3] / 255 * fgOpac;

            let bgR = bgData[bgIndex];
            let bgG = bgData[bgIndex + 1];
            let bgB = bgData[bgIndex + 2];

            // alpha blending 
            bgData[bgIndex] = fgR * fgA + (1 - fgA) * bgR;
            bgData[bgIndex + 1] = fgG * fgA + (1 - fgA) * bgG;
            bgData[bgIndex + 2] = fgB * fgA + (1 - fgA) * bgB;


        }
    }

}
