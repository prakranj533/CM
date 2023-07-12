export const getDateStr = () => {
    const date = new Date();
    const dd = `0${date.getDate()}`.slice(-2);
    const mm = `0${date.getMonth() + 1}`.slice(-2);
    const yyyy = date.getFullYear();

    return `${dd}/${mm}/${yyyy}`;
}