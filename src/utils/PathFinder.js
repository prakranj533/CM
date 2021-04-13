export default class PathFinder {

    constructor(nodeMap) {
        this.nodeMap = nodeMap;
    }

    getAllPaths(sourceNodeId, destinationNodeId) {
        this.allPaths = [];
        this.sourceNodeId = sourceNodeId;
        this.destinationNodeId = destinationNodeId;
        this.findPath(this.sourceNodeId, [], { duration: 0, skills: "" });
        const formatPath = path => path.map(e => ({ ...e, name: this.nodeMap[e.id].name }));
        return this.allPaths.map(formatPath);
    }

    findPath(currNodeId, visitedNodes, path) {
        this.nodeMap[currNodeId].paths.map(path => this.nodeMap[path.to].name);
        if (!visitedNodes.includes(e => e.id === currNodeId)) {
            const updatedVisitedNodes = [...visitedNodes, {
                id: currNodeId,
                duration: path.duration,
                totalDuration: (visitedNodes.length ? visitedNodes[visitedNodes.length - 1].totalDuration : 0) + path.duration,
                skills: path.skills.split(",").filter(e => e)
            }];
            if (currNodeId === this.destinationNodeId)
                this.allPaths.push(updatedVisitedNodes);
            const node = this.nodeMap[currNodeId];
            node.paths.forEach(path => this.findPath(path.to, updatedVisitedNodes, path));
        }
    }

}