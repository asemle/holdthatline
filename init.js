'use strict';

const node = document.getElementById('app');

// Update the second argument to `Elm.Main.embed` with your selected API. See
// the Intro section of the technical assessment documentation for more
// information:
// https://technical-assessment.konicaminoltamarketplace.com
const app = Elm.Main.embed(node, {
    api: 'Client',
    hostname: '',
});

app.ports.startTimer.subscribe((int) => {
    setTimeout(() => {
        app.ports.timeout.send(int);
    }, 10000);
});


var turn;
var selected;
var lines = [];
var startExtended = false;


app.ports.request.subscribe((req) => {

    req = JSON.parse(req);

    var response;

    if (req.msg == "INITIALIZE") {
        response = {
            "msg": "INITIALIZE",
            "body": {
                "newLine": null,
                "heading": "Player 1",
                "message": "Awaiting Player 1's Move"
            }
        }
        turn = 1;
        selected = null;
    }

    else if (req.msg == "NODE_CLICKED") {

        response = processNodeClicked(req.body);
    }

    else {
        throw new Exception("Unknown message: " + req.message);
    }
    console.log(response);
    app.ports.response.send(response);
})



//process click
function processNodeClicked(point) {

    var outgoing = new Object();

    outgoing.body = new Object();

    //first selection
    if(!lines.length && !selected) {
        outgoing.msg = "VALID_START_NODE FIRST";

        outgoing.body.newLine = null;
        outgoing.body.heading = "Player " + turn;
        outgoing.body.message = "Select a second node to complete the line.";

        selected = point;
    }

    //check if start point
    else if (!selected) {
        // check if start point is end of line
        if (lines.filter(line => (JSON.stringify(line.start) == JSON.stringify(point) || JSON.stringify(line.end) == JSON.stringify(point))).length == 1) {
        
            outgoing.msg = "VALID_START_NODE";

            outgoing.body.newLine = null;
            outgoing.body.heading = "Player " + turn;
            outgoing.body.message = "Select a second node to complete the line.";

            selected = point;
        } else {

            outgoing.msg = "INVALID_START_NODE MUST CONTINUE LINE";

            outgoing.body.newLine = null;
            outgoing.body.heading = "Player " + turn;
            outgoing.body.message = "You must start on either end of the path!";

            selected = null;

        }

    
    //if not a starting point, check for valid endpoint
    //If end node === start node, return invalid, reset selection to null
    } else if (point.x == selected.x && point.y == selected.y) {

        outgoing.msg = "INVALID_END_NODE";

        outgoing.body.newLine = null;
        outgoing.body.heading = "Player " + turn;
        outgoing.body.message = "Invalid move. Try again.";

        selected = null;
    // check if end point has already been used
    
    } else if ((lines.filter(line => pointIsOnLine(point, line)).length !== 0)) {
        outgoing.msg = "INVALID_END_NODE";

        outgoing.body.newLine = null;
        outgoing.body.heading = "Player " + turn;
        outgoing.body.message = "Invalid move. Try again.";

        selected = null;
    //check if end point causes new line to to intersect any other line
    } else if (lines.reduce((prev, curr) => (intersects(selected.x, selected.y, point.x, point.y, curr.start.x, curr.start.y, curr.end.x, curr.end.y) ? true : prev),false)) {
        outgoing.msg = "INVALID_END_NODE";

        outgoing.body.newLine = null;
        outgoing.body.heading = "Player " + turn;
        outgoing.body.message = "Invalid move. Try again.";

        selected = null;
    
    // check if line is not octilinear
    } else if (checkSlope(selected.x, selected.y, point.x, point.y)) {
        outgoing.msg = "INVALID_END_NODE";

        outgoing.body.newLine = null;
        outgoing.body.heading = "Player " + turn;
        outgoing.body.message = "Invalid move.Try again.";

        selected = null;
    //if endpoint is not taken, new line does not intersect any other, and line is octilinear, return new line 
    } else {
        var newLine = {
            "start": selected,
            "end": point
        }
        
        // add new endpoint to lines array
        //check if newLine extends from end or original starting point, for checkEndGame fn
        if (lines.length === 0 || JSON.stringify(lines[lines.length -1].end) === JSON.stringify(selected)) {
            lines.push(newLine);
        } else {
            lines.unshift(newLine)
            startExtended = true;
        }
        if(checkGameOver()) {
            turn = turn == 1 ? 2 : 1;

            outgoing.msg = "GAME_OVER";
            outgoing.body.heading = "Game Over";
            outgoing.body.message = "Player " + turn + " wins!";
            outgoing.body.newLine = newLine;
        } else {
            //Line is deemed valid, so we create a line
            outgoing.msg = "VALID_END_NODE";

            //This will shift back and forth between 1 and 2            
            turn = turn == 1 ? 2 : 1;
            outgoing.body.newLine = newLine;
            outgoing.body.heading = "Player " + turn;
            outgoing.body.message = null;
            selected = null;
        }
    }
    return outgoing;
}

// returns true if the line from (a,b)->(c,d) intersects with (p,q)->(r,s)
function intersects(a, b, c, d, p, q, r, s) {
    var det, gamma, lambda;
    det = (c - a) * (s - q) - (r - p) * (d - b);
    if (det === 0) {
        return false;
    } else {
        lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
        gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
        return (0 < lambda && lambda < 1.01) && (0 < gamma && gamma < 1.01);
    }
};

function checkSlope(startX, startY, endX, endY) {
    var slope = (endY - startY) / (endX - startX);
    return Math.abs(slope) === 1 ? false : Math.abs(slope) === 0 ? false : Math.abs(slope) === Infinity ? false : true;
};

//if all points surrounding the endpoints are taken, return true
function checkGameOver() {
//take the line's endpoints
    var endPoint = lines[lines.length - 1].end;
    var startPoint = startExtended ? lines[0].end : lines[0].start;
    //return true if all points surrounding endpoints are taken
    return checkAllPointsTaken(startPoint) && checkAllPointsTaken(endPoint) ? true : false;
}

// if all surrounding points are taken return true;
function checkAllPointsTaken(point) {
    var surroundingPoints = 
        [
            {"x":point.x - 1, "y":point.y},
            {"x":point.x - 1, "y":point.y + 1},
            {"x":point.x, "y":point.y + 1},
            {"x":point.x + 1, "y":point.y + 1},
            {"x":point.x + 1, "y":point.y},
            {"x":point.x + 1, "y":point.y - 1},
            {"x":point.x, "y":point.y - 1},
            {"x":point.x - 1, "y":point.y - 1}
        ]
    // filter out points that are out of bounds
    surroundingPoints = surroundingPoints.filter(surrPoint => surrPoint.x >= 0 && surrPoint.x < 4 && surrPoint.y >= 0 && surrPoint.y < 4);
        
    
    return surroundingPoints.reduce(function(prev, surrPoint) {
        // check if all surrounding points are plotted in lines arr
        if(!lines.find(line => pointIsOnLine(surrPoint, line, point))) {

            // if not, check if potential line to unused point intersects any line
            //returns true if all points are taken or potential lines intersects any line
            return lines.reduce((prev, curr) => (intersects(point.x, point.y, surrPoint.x, surrPoint.y, curr.start.x, curr.start.y, curr.end.x, curr.end.y) ? true : prev), false) ? prev : false;
           
        } else {
         return prev
        }
    }, true) 
         
}

function pointIsOnLine(point, line) {
// y = mx + b 
    var m = (line.end.y - line.start.y)/ (line.end.x - line.start.x);
    var b = line.end.y - m * line.end.x;
    if(point.y === m * point.x + b || Math.abs(m) === Infinity && point.x === line.end.x || m === 0 && point.y === line.end.y) {
// make sure point falls on segment
        return ((line.start.x <= point.x && point.x <= line.end.x && line.start.y <= point.y && point.y <= line.end.y) || line.end.x <= point.x && point.x <= line.start.x && line.end.y <= point.y && point.y <= line.start.y || line.end.x <= point.x && point.x <= line.start.x && line.start.y <= point.y && point.y <= line.end.y || line.start.x <= point.x && point.x <= line.end.x && line.end.y <= point.y && point.y <= line.start.y);       
    } else {
         return false;
        

    }
}




