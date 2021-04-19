export default class PathFinder {

    constructor(nodeMap) {
        this.nodeMap = nodeMap;
    }

    getAllPaths(sourceNodeId, destinationNodeId) {
        this.allPaths = [];
        this.sourceNodeId = sourceNodeId;
        this.destinationNodeId = destinationNodeId;
        try {
            this.findPath(this.sourceNodeId, [], { duration: "", skills: "" });
            const formatPath = path => path.map(e => ({ ...e, name: this.nodeMap[e.id].name }));
            return this.allPaths.map(formatPath);
        } catch (e) {
            console.log(e);
        }
        return [];
    }

    findPath(currNodeId, visitedNodes, path) {
        if (!visitedNodes.includes(e => e.id === currNodeId)) {
            const updatedVisitedNodes = [...visitedNodes, {
                id: currNodeId,
                duration: path.duration,
                skills: path.skills.split(",").filter(e => e)
            }];
            if (currNodeId === this.destinationNodeId)
                this.allPaths.push(updatedVisitedNodes);
            const node = this.nodeMap[currNodeId];
            node.paths.forEach(path => this.findPath(path.to, updatedVisitedNodes, path));
        }
    }

}